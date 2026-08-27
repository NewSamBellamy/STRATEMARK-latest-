import { describe, it, expect } from 'vitest';
import { readEnv } from '../env';
import {
  authorizeSpend,
  UnauthorizedSpendError,
  RateLimiter,
  RateLimitedError,
  callerKeyFor,
} from '../lib/authz';
import { DailyBudget, BudgetExhaustedError, DEFAULT_DAILY_CAP_USD } from '../lib/budget';

const base = { PORT: '8080' } as NodeJS.ProcessEnv;

describe('authorizeSpend — browsing is free, spending is not', () => {
  it('always allows a caller who brings their own key', () => {
    // No app token configured at all, and it still works: they pay, not us.
    const authz = authorizeSpend({ env: readEnv(base), callerKey: 'AIza-their-own' });
    expect(authz).toEqual({ mode: 'caller-key', metered: false });
  });

  it('allows a valid app token and marks it metered', () => {
    const env = readEnv({ ...base, APP_TOKEN: 'secret-token' });
    expect(authorizeSpend({ env, appToken: 'secret-token' })).toEqual({
      mode: 'app-token',
      metered: true,
    });
  });

  it('refuses when no token is configured — failing shut, not open', () => {
    // This is the property that matters: a service attached to a billing
    // account must not become an open faucet through a missing env var.
    expect(() => authorizeSpend({ env: readEnv(base) })).toThrow(UnauthorizedSpendError);
  });

  it('refuses a wrong token', () => {
    const env = readEnv({ ...base, APP_TOKEN: 'secret-token' });
    expect(() => authorizeSpend({ env, appToken: 'guess' })).toThrow(UnauthorizedSpendError);
  });

  it('refuses a token of the right length but wrong content', () => {
    const env = readEnv({ ...base, APP_TOKEN: 'aaaaaa' });
    expect(() => authorizeSpend({ env, appToken: 'bbbbbb' })).toThrow(UnauthorizedSpendError);
  });

  it('ignores a caller key that is only invisible characters and falls through', () => {
    const env = readEnv({ ...base, APP_TOKEN: 'secret-token' });
    expect(authorizeSpend({ env, callerKey: '​  ', appToken: 'secret-token' }).mode).toBe('app-token');
  });

  it('explains both routes in the refusal', () => {
    try {
      authorizeSpend({ env: readEnv(base) });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toMatch(/X-Gemini-Key/);
      expect((err as Error).message).toMatch(/X-Stratemark-Token/);
    }
  });
});

describe('DailyBudget — the ceiling max-instances cannot provide', () => {
  it('defaults to a real cap, never unlimited', () => {
    expect(readEnv(base).dailyCapUsd).toBe(DEFAULT_DAILY_CAP_USD);
  });

  it('treats a malformed or hostile cap as the default rather than unlimited', () => {
    expect(readEnv({ ...base, DAILY_CAP_USD: 'lots' }).dailyCapUsd).toBe(DEFAULT_DAILY_CAP_USD);
    expect(readEnv({ ...base, DAILY_CAP_USD: '-5' }).dailyCapUsd).toBe(DEFAULT_DAILY_CAP_USD);
    expect(readEnv({ ...base, DAILY_CAP_USD: '0' }).dailyCapUsd).toBe(DEFAULT_DAILY_CAP_USD);
    expect(readEnv({ ...base, DAILY_CAP_USD: '12.5' }).dailyCapUsd).toBe(12.5);
  });

  it('starts empty and affordable', () => {
    const b = new DailyBudget(1);
    expect(b.status().spentUsd).toBe(0);
    expect(b.status().exhausted).toBe(false);
    expect(b.canAfford(0.65)).toBe(true);
  });

  it('accumulates estimated spend per call kind', () => {
    const b = new DailyBudget(1);
    b.record('ground', 10); // 10 × $0.04
    b.record('structure', 5); // 5 × $0.002
    expect(b.status().spentUsd).toBeCloseTo(0.41, 4);
    expect(b.status().groundedCalls).toBe(10);
  });

  it('refuses work it cannot afford BEFORE the work begins', () => {
    const b = new DailyBudget(0.5);
    b.record('ground', 10); // $0.40 spent, $0.10 left
    // A deck is ~27 requests. Half a deck is worse than no deck.
    expect(b.canAfford(0.65)).toBe(false);
    expect(b.canAfford(0.05)).toBe(true);
  });

  it('reports exhaustion once the cap is reached', () => {
    const b = new DailyBudget(0.4);
    b.record('ground', 10);
    expect(b.status().exhausted).toBe(true);
    expect(b.status().remainingUsd).toBe(0);
  });

  it('never reports negative remaining budget', () => {
    const b = new DailyBudget(0.1);
    b.record('ground', 100);
    expect(b.status().remainingUsd).toBe(0);
  });

  it('produces an error that tells the user how to unblock themselves', () => {
    const b = new DailyBudget(0.04);
    b.record('ground');
    const err = new BudgetExhaustedError(b.status());
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/X-Gemini-Key/);
    expect(err.message).toMatch(/\$0\.04/);
  });
});

describe('RateLimiter', () => {
  it('allows traffic up to the limit', () => {
    const rl = new RateLimiter(3, 60_000);
    expect(() => {
      rl.check('a', 1000);
      rl.check('a', 1001);
      rl.check('a', 1002);
    }).not.toThrow();
  });

  it('rejects the request past the limit', () => {
    const rl = new RateLimiter(2, 60_000);
    rl.check('a', 1000);
    rl.check('a', 1001);
    expect(() => rl.check('a', 1002)).toThrow(RateLimitedError);
  });

  it('tracks callers independently', () => {
    const rl = new RateLimiter(1, 60_000);
    rl.check('a', 1000);
    expect(() => rl.check('b', 1000)).not.toThrow();
  });

  it('lets the window slide so a limit is not permanent', () => {
    const rl = new RateLimiter(1, 1_000);
    rl.check('a', 1000);
    expect(() => rl.check('a', 1500)).toThrow(RateLimitedError);
    expect(() => rl.check('a', 2600)).not.toThrow();
  });

  it('tells the caller how long to wait', () => {
    const rl = new RateLimiter(1, 10_000);
    rl.check('a', 1000);
    try {
      rl.check('a', 3000);
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toMatch(/8 seconds/);
    }
  });
});

describe('callerKeyFor', () => {
  it('prefers the client IP from the forwarded chain', () => {
    expect(callerKeyFor({ forwardedFor: '203.0.113.9, 10.0.0.1' })).toBe('203.0.113.9');
  });

  it('falls back to a token prefix, then to a constant', () => {
    expect(callerKeyFor({ appToken: 'abcdefghijklmnop' })).toBe('abcdefghijkl');
    expect(callerKeyFor({})).toBe('anonymous');
  });
});
