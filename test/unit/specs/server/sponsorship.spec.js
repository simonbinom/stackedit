const sponsorship = require('../../../../server/sponsorship');

describe('sponsorship payments', () => {
  test('accepts only configured payment amounts', () => {
    expect(sponsorship.getDuration(5)).toBeGreaterThan(0);
    expect(sponsorship.getDuration(12)).toBe(0);
  });

  test('extends an active sponsorship and preserves user data', () => {
    const now = 1000;
    const existingUser = {
      name: 'Ada',
      sponsorUntil: 2000,
    };

    const result = sponsorship.applyPayment(existingUser, {
      duration: 500,
      paypalEmail: 'ada@example.com',
      transactionId: 'txn-1',
    }, now);

    expect(result.applied).toBe(true);
    expect(result.user).toEqual({
      name: 'Ada',
      paypalEmail: 'ada@example.com',
      paypalTransactionIds: ['txn-1'],
      sponsorUntil: 2500,
    });
  });

  test('ignores a transaction that was already applied', () => {
    const existingUser = {
      paypalTransactionIds: ['txn-1'],
      sponsorUntil: 2000,
    };

    const result = sponsorship.applyPayment(existingUser, {
      duration: 500,
      paypalEmail: 'ada@example.com',
      transactionId: 'txn-1',
    }, 1000);

    expect(result.applied).toBe(false);
    expect(result.user).toBe(existingUser);
  });
});
