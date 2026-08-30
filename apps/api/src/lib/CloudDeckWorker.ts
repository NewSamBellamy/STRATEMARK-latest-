import { runLivingDeckEngine } from '@mi/research';
import type { TaskPayload } from './CloudTasksAdapter';
import type { ServiceEnv } from '../env';
import { resolveClient } from './client';
import type { CloudDeckService } from './CloudDeckService';
import type { CardWithCompany } from '@mi/contracts';
import type { HydrateCompanyCardResult } from '@mi/research';

export class CloudDeckWorker {
  constructor(
    private readonly env: ServiceEnv,
    private readonly service: CloudDeckService
  ) {}

  async processDeckCreation(payload: TaskPayload): Promise<void> {
    const { deckId, userId, plan, watch, maxCandidates } = payload;
    
    // Check if deck exists
    const existing = await this.service.getDeck(userId, deckId);
    if (!existing) {
      console.warn(`Deck ${deckId} not found for processing`);
      return;
    }

    // Check entitlement again
    const isEntitled = await this.service.checkEntitlement(userId);
    if (!isEntitled) {
      console.warn(`User ${userId} lost entitlement during processing`);
      await this.service.saveDeck(userId, deckId, {
        ...existing,
        state: { status: 'failed', error: 'Entitlement lost' }
      });
      return;
    }

    const resolved = resolveClient({ env: this.env });
    
    let currentCards = existing.cards ?? [];
    let savePromise = Promise.resolve();
    const abortController = new AbortController();
    const timeoutSignal = AbortSignal.timeout(540_000);
    
    const onAbort = () => abortController.abort();
    timeoutSignal.addEventListener('abort', onAbort);

    const run = await runLivingDeckEngine({
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
              const stillEntitled = await this.service.checkEntitlement(userId);
              if (!stillEntitled) {
                 abortController.abort(new Error('Entitlement lost'));
                 throw new Error('Entitlement lost during run');
              }
              const fresh = await this.service.getDeck(userId, deckId);
              if (fresh) {
                 await this.service.saveDeck(userId, deckId, {
                   ...fresh,
                   cards: currentCards,
                   state: { status: 'partial' }
                 }, fresh.revision);
              }
            }).catch(err => {
              console.error('Checkpoint failed:', err);
              if (err.message.includes('Entitlement lost')) {
                 abortController.abort(err);
                 throw err;
              }
            });
          }
        }
      }
    });

    timeoutSignal.removeEventListener('abort', onAbort);

    await savePromise.catch(() => {});

    // Determine final status
    const isFailed = run.aborted || run.state.status === 'failed';
    const finalStatus = isFailed ? 'failed' : 'ready';

    const fresh = await this.service.getDeck(userId, deckId);
    if (fresh) {
      await this.service.saveDeck(userId, deckId, {
        ...fresh,
        cards: run.hydrated.flatMap(h => h.cards),
        state: { status: finalStatus, ...(isFailed ? { error: 'Research aborted or failed' } : {}) }
      }, fresh.revision);
    }
  }
}
