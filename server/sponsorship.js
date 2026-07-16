const durationsByGross = {
  5: 3 * 31 * 24 * 60 * 60 * 1000,
  15: 366 * 24 * 60 * 60 * 1000,
  25: 2 * 366 * 24 * 60 * 60 * 1000,
  50: 5 * 366 * 24 * 60 * 60 * 1000,
};

const maxStoredTransactionIds = 50;

exports.getDuration = gross => durationsByGross[gross] || 0;

exports.applyPayment = (existingUser, payment, now = Date.now()) => {
  const user = existingUser || {};
  const transactionIds = Array.isArray(user.paypalTransactionIds)
    ? user.paypalTransactionIds
    : [];
  if (transactionIds.includes(payment.transactionId)) {
    return {
      applied: false,
      user,
    };
  }

  const existingSponsorUntil = Number(user.sponsorUntil) || 0;
  return {
    applied: true,
    user: Object.assign({}, user, {
      paypalEmail: payment.paypalEmail,
      paypalTransactionIds: transactionIds
        .concat(payment.transactionId)
        .slice(-maxStoredTransactionIds),
      sponsorUntil: Math.max(now, existingSponsorUntil) + payment.duration,
    }),
  };
};
