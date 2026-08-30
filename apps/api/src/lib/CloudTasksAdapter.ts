import { CloudTasksClient } from '@google-cloud/tasks';
import type { MarketPlan } from '@mi/research';
import type { ServiceEnv } from '../env';

export interface TaskPayload {
  deckId: string;
  userId: string;
  plan: MarketPlan;
  query: string;
  maxCandidates?: number;
  watch?: boolean;
}

export interface TasksAdapter {
  enqueueDeckCreation(payload: TaskPayload): Promise<void>;
}

export class CloudTasksAdapter implements TasksAdapter {
  private client: CloudTasksClient;
  private config: NonNullable<ServiceEnv['tasks']>;

  constructor(env: ServiceEnv, client?: CloudTasksClient) {
    if (!env.tasks) {
      throw new Error('Cloud Tasks is not configured in this environment');
    }
    this.config = env.tasks;
    this.client = client ?? new CloudTasksClient();
  }

  async enqueueDeckCreation(payload: TaskPayload): Promise<void> {
    const parent = this.client.queuePath(this.config.projectId, this.config.location, this.config.queue);
    
    // We use the deckId as part of the task ID to ensure idempotency.
    // If the same task is queued twice, Cloud Tasks will deduplicate based on the name.
    const taskId = `deck-create-${payload.deckId}`;
    const taskName = `${parent}/tasks/${taskId}`;

    const task = {
      name: taskName,
      httpRequest: {
        httpMethod: 'POST' as const,
        url: this.config.workerUrl,
        oidcToken: {
          serviceAccountEmail: this.config.serviceAccountEmail,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
    };

    try {
      await this.client.createTask({ parent, task });
    } catch (e: unknown) {
      const err = e as Error & { code?: string | number };
      // 409 means ALREADY_EXISTS. This is expected due to our idempotent task name.
      if (err.code !== 6 && err.code !== 'ALREADY_EXISTS') {
        throw err;
      }
    }
  }
}

export class MockTasksAdapter implements TasksAdapter {
  public queuedTasks: TaskPayload[] = [];
  
  async enqueueDeckCreation(payload: TaskPayload): Promise<void> {
    this.queuedTasks.push(payload);
  }
}
