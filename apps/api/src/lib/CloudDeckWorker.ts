import { runLivingDeckEngine, expandDeckWithDeltaAgent, type MarketPlan } from '@mi/research';
import type { TaskPayload, RefreshTaskPayload } from './CloudTasksAdapter';
import type { ServiceEnv } from '../env';
import { resolveClient } from './client';
import type { CloudDeckService } from './CloudDeckService';
import type { CardWithCompany } from '@mi/contracts';
import type { HydrateCompanyCardResult } from '@mi/research';
import type { StoredDeckRecord } from './firestoreStore';

export interface DeckIdentity {
  userId: string;
  deckId: string;
}

export class CloudDeckWorker {
  constructor(
    private readonly env: ServiceEnv,
    private readonly service: CloudDeckService
  ) {}

  private async updateDeckState(
    id: DeckIdentity, 
    mutator: (deck: StoredDeckRecord) => Partial<StoredDeckRecord>
  ): Promise<void> {
    const fresh = await this.service.getDeck(id.userId, id.deckId);
    if (fresh) {
      const updates = mutator(fresh);
      await this.service.saveDeck(id.userId, id.deckId, {
        ...fresh,
        ...updates
      }, fresh.revision);
    }
  }

  async processDeckCreation(payload: TaskPayload): Promise<void> {
    const { deckId, userId, plan, watch, maxCandidates } = payload;
    const id: DeckIdentity = { userId, deckId };
    
    // Check if deck exists
    const existing = await this.service.getDeck(userId, deckId);
    if (!existing) {
      console.warn(`Deck ${deckId} not found for processing`);
      return;
    }

    // Idempotent no-op if deck is already ready
    if (existing.state?.status === 'ready') {
      return;
    }

    // Check entitlement again
    const isEntitled = await this.service.checkEntitlement(userId);
    if (!isEntitled) {
      console.warn(`User ${userId} lost entitlement during processing`);
      await this.updateDeckState(id, () => ({
        state: { status: 'failed', error: 'Entitlement lost' }
      }));
      return;
    }

    let currentCards = existing.cards ?? [];
    let savePromise = Promise.resolve();
    const abortController = new AbortController();
    const timeoutSignal = AbortSignal.timeout(540_000);
    
    const onAbort = () => abortController.abort();
    timeoutSignal.addEventListener('abort', onAbort);

    let run: Awaited<ReturnType<typeof runLivingDeckEngine>>;
    try {
      const resolved = resolveClient({ env: this.env });
      run = await runLivingDeckEngine({
        client: resolved.client,
        plan,
        deckId,
        watch: watch ?? false,
        ...(maxCandidates === undefined ? {} : { maxCandidates }),
        signal: abortController.signal,
        onEvent: (event) => {
          if (event.type === 'card' || event.type === 'growth') {
            const result = event.type === 'card' ? event.result : event.card;

            // event.result is HydrateCompanyCardResult, which has multiple cards in result.cards
            // event.card from 'growth' is a CardWithCompany
            const newCards = event.type === 'card'
              ? (result as HydrateCompanyCardResult).cards
              : [result as CardWithCompany];

            let updated = false;
            for (const card of newCards) {
              const isDuplicate = currentCards.some(c => c.card.id === card.card.id);
              if (!isDuplicate) {
                currentCards = [...currentCards, card];
                updated = true;
              }
            }

            if (updated) {
              // Serialize intermediate checkpoints to avoid 409s/conflicts
              savePromise = savePromise.then(async () => {
                const freshDeck = await this.service.getDeck(userId, deckId);
                if (!freshDeck) {
                  abortController.abort(new Error('Deck deleted'));
                  return;
                }
                const stillEntitled = await this.service.checkEntitlement(userId);
                if (!stillEntitled) {
                  abortController.abort(new Error('Entitlement lost'));
                  throw new Error('Entitlement lost during run');
                }
                await this.updateDeckState(id, () => ({
                  cards: currentCards,
                  state: { status: 'partial' }
                }));
              }).catch(err => {
                console.error('Checkpoint failed:', err);
                if (err instanceof Error && (err.message.includes('Entitlement lost') || err.message.includes('Deck deleted'))) {
                  abortController.abort(err);
                  throw err;
                }
              });
            }
          }
        }
      });
    } catch (err: unknown) {
      timeoutSignal.removeEventListener('abort', onAbort);
      const freshDeck = await this.service.getDeck(userId, deckId);
      if (!freshDeck) return; // Clean exit on deletion

      const message = err instanceof Error ? err.message : String(err);
      await this.updateDeckState(id, () => ({
        cards: currentCards,
        state: { status: 'failed', error: message.slice(0, 500) }
      }));
      // A terminal model/configuration failure should not be retried forever.
      console.error(JSON.stringify({
        severity: 'ERROR',
        message: 'Cloud deck creation failed',
        deckId,
        error: message,
      }));
      return;
    }

    timeoutSignal.removeEventListener('abort', onAbort);

    await savePromise.catch(() => {});

    const freshDeck = await this.service.getDeck(userId, deckId);
    if (!freshDeck) return; // Deleted during processing

    // Determine final status
    const isFailed = run.aborted || run.state.status === 'failed';
    const finalStatus = isFailed ? 'failed' : 'ready';
    const failedReason = run.aborted
      ? 'Research timed out or was aborted'
      : run.statuses.find((status) => status.state === 'failed')?.error ?? 'Research failed';

    const cardMap = new Map<string, CardWithCompany>();
    for (const c of currentCards) {
      if (c?.card?.id) cardMap.set(c.card.id, c);
    }
    for (const h of run.hydrated) {
      for (const c of h.cards) {
        if (c?.card?.id) cardMap.set(c.card.id, c);
      }
    }
    const finalCards = Array.from(cardMap.values());

    await this.updateDeckState(id, () => ({
      cards: finalCards,
      state: { status: finalStatus, ...(isFailed ? { error: failedReason } : {}) }
    }));
  }

  async processDeckRefresh(payload: RefreshTaskPayload): Promise<void> {
    const { deckId, userId, query } = payload;
    const id: DeckIdentity = { userId, deckId };
    
    const existing = await this.service.getDeck(userId, deckId);
    if (!existing) {
      console.warn(`Deck ${deckId} not found for refresh`);
      return;
    }

    const isEntitled = await this.service.checkEntitlement(userId);
    if (!isEntitled) {
      console.warn(`User ${userId} lost entitlement before refresh`);
      await this.updateDeckState(id, () => ({
        state: { status: 'ready', error: 'Entitlement lost' }
      }));
      return;
    }

    const resolved = resolveClient({ env: this.env });
    
    try {
      const plan = existing.plan as MarketPlan | undefined;
      const vertical = plan?.vertical ?? 'market-intel';

      const updatedCards = await expandDeckWithDeltaAgent({
        client: resolved.client,
        marketName: query,
        vertical: vertical,
        existingCards: existing.cards ?? [],
      });
      
      await this.updateDeckState(id, () => ({
        cards: updatedCards,
        refreshedAt: new Date().toISOString(),
        state: { status: 'ready' }
      }));
    } catch (err: unknown) {
      await this.updateDeckState(id, () => ({
        state: { status: 'ready', error: err instanceof Error ? err.message : String(err) }
      }));
    }
  }
}
