const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { OAuth2Client } = require('google-auth-library');
const conf = require('./conf');

const s3Client = new S3Client({});
const googleAuthClient = new OAuth2Client(conf.values.googleClientId);

const bodyToString = (body) => {
  if (!body) {
    return Promise.resolve('');
  }
  if (typeof body === 'string') {
    return Promise.resolve(body);
  }
  if (Buffer.isBuffer(body)) {
    return Promise.resolve(body.toString('utf-8'));
  }
  if (typeof body.transformToString === 'function') {
    return body.transformToString('utf-8');
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    body.on('data', chunk => chunks.push(chunk));
    body.on('error', reject);
    body.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
};

exports.getUser = async (id) => {
  try {
    const res = await s3Client.send(new GetObjectCommand({
      Bucket: conf.values.userBucketName,
      Key: id,
    }));
    return JSON.parse(await bodyToString(res.Body));
  } catch (err) {
    if (err.name !== 'NoSuchKey') {
      throw err;
    }
    return undefined;
  }
};

exports.putUser = (id, user) => s3Client.send(new PutObjectCommand({
  Bucket: conf.values.userBucketName,
  Key: id,
  Body: JSON.stringify(user),
}));

exports.getUserFromToken = async (idToken) => {
  const ticket = await googleAuthClient.verifyIdToken({
    idToken,
    audience: conf.values.googleClientId,
  });
  return exports.getUser(ticket.getPayload().sub);
};

exports.userInfo = (req, res) => exports.getUserFromToken(req.query.idToken)
  .then(
    user => res.send(Object.assign({
      sponsorUntil: 0,
    }, user)),
    err => res
      .status(400)
      .send(err ? err.message || err.toString() : 'invalid_token'),
  );

exports.paypalIpn = (req, res, next) => Promise.resolve()
  .then(() => {
    const userId = req.body.custom;
    const paypalEmail = req.body.payer_email;
    const gross = parseFloat(req.body.mc_gross);
    let sponsorUntil;
    if (gross === 5) {
      sponsorUntil = Date.now() + (3 * 31 * 24 * 60 * 60 * 1000); // 3 months
    } else if (gross === 15) {
      sponsorUntil = Date.now() + (366 * 24 * 60 * 60 * 1000); // 1 year
    } else if (gross === 25) {
      sponsorUntil = Date.now() + (2 * 366 * 24 * 60 * 60 * 1000); // 2 years
    } else if (gross === 50) {
      sponsorUntil = Date.now() + (5 * 366 * 24 * 60 * 60 * 1000); // 5 years
    }
    if (
      req.body.receiver_email !== conf.values.paypalReceiverEmail ||
      req.body.payment_status !== 'Completed' ||
      req.body.mc_currency !== 'USD' ||
      (req.body.txn_type !== 'web_accept' && req.body.txn_type !== 'subscr_payment') ||
      !userId || !sponsorUntil
    ) {
      // Ignoring PayPal IPN
      return res.end();
    }
    // Processing PayPal IPN
    const paypalBody = new URLSearchParams(Object.assign({}, req.body, {
      cmd: '_notify-validate',
    }));
    return fetch(conf.values.paypalUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paypalBody,
    })
      .then(response => response.text())
      .then((verificationBody) => {
        if (verificationBody !== 'VERIFIED') {
          throw new Error('PayPal IPN unverified');
        }
      })
      .then(() => exports.putUser(userId, {
        paypalEmail,
        sponsorUntil,
      }))
      .then(() => res.end());
  })
  .catch(next);

exports.checkSponsor = (idToken) => {
  if (!conf.publicValues.allowSponsorship) {
    return Promise.resolve(true);
  }
  if (!idToken) {
    return Promise.resolve(false);
  }
  return exports.getUserFromToken(idToken)
    .then(userInfo => userInfo && userInfo.sponsorUntil > Date.now(), () => false);
};
