const conf = require('./conf');

async function githubToken(clientId, code) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: conf.values.githubClientSecret,
    code,
  });
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/x-www-form-urlencoded',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const token = new URLSearchParams(await response.text()).get('access_token');
  if (!response.ok || !token) {
    throw new Error(response.statusText || response.status);
  }
  return token;
}

exports.githubToken = (req, res) => {
  githubToken(req.query.clientId, req.query.code)
    .then(
      token => res.send(token),
      err => res
        .status(400)
        .send(err ? err.message || err.toString() : 'bad_code'),
    );
};
