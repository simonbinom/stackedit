const conf = require('./conf');

async function githubToken(code, codeVerifier) {
  const body = new URLSearchParams({
    client_id: conf.values.githubClientId,
    client_secret: conf.values.githubClientSecret,
    code,
    code_verifier: codeVerifier,
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: controller.signal,
    });
    const token = (await response.json()).access_token;
    if (!response.ok || !token) {
      throw new Error(response.statusText || response.status);
    }
    return token;
  } finally {
    clearTimeout(timeoutId);
  }
}

exports.githubToken = (req, res) => {
  const code = req.body && req.body.code;
  const codeVerifier = req.body && req.body.codeVerifier;
  res.set('Cache-Control', 'no-store');
  if (typeof code !== 'string' || !code || code.length > 1024
    || typeof codeVerifier !== 'string'
    || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) {
    res.status(400).send('bad_code');
    return;
  }
  return githubToken(code, codeVerifier)
    .then(
      (token) => {
        res.send(token);
      },
      () => res
        .status(400)
        .send('bad_code'),
    );
};
