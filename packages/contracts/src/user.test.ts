import { describe, expect, it } from 'vitest';
import { userMeResponseSchema, userSchema } from './schemas';

describe('userSchema & subscription tiers', () => {
  it('parses valid user object with free tier', () => {
    const raw = {
      id: 'usr_123',
      email: 'alex@stratemark.ai',
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: '2026-08-12T10:00:00Z',
    };

    const parsed = userSchema.parse(raw);
    expect(parsed.id).toBe('usr_123');
    expect(parsed.subscriptionTier).toBe('free');
    expect(parsed.subscriptionStatus).toBe('active');
  });

  it('parses valid user object with pro tier', () => {
    const raw = {
      id: 'usr_456',
      email: 'pro@stratemark.ai',
      subscriptionTier: 'pro',
      subscriptionStatus: 'trialing',
      stripeCustomerId: 'cus_789',
      createdAt: '2026-08-12T10:00:00Z',
    };

    const parsed = userSchema.parse(raw);
    expect(parsed.subscriptionTier).toBe('pro');
    expect(parsed.subscriptionStatus).toBe('trialing');
    expect(parsed.stripeCustomerId).toBe('cus_789');
  });

  it('falls back to free tier when subscriptionTier is unrecognised or invalid', () => {
    const raw = {
      id: 'usr_789',
      email: 'test@stratemark.ai',
      subscriptionTier: 'enterprise', // invalid tier now that only 'free' | 'pro' supported
      subscriptionStatus: 'active',
      createdAt: '2026-08-12T10:00:00Z',
    };

    const parsed = userSchema.parse(raw);
    expect(parsed.subscriptionTier).toBe('free');
  });

  it('parses userMeResponseSchema payload', () => {
    const responsePayload = {
      user: {
        id: 'usr_me',
        email: 'me@stratemark.ai',
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
        createdAt: '2026-08-12T10:00:00Z',
      },
    };

    const parsed = userMeResponseSchema.parse(responsePayload);
    expect(parsed.user.id).toBe('usr_me');
    expect(parsed.user.subscriptionTier).toBe('pro');
  });
});
