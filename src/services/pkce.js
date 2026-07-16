const toBase64Url = bytes => btoa(String.fromCharCode(...bytes))
  .replace(/\//g, '_')
  .replace(/\+/g, '-')
  .replace(/=+$/, '');

export default async (cryptoImpl = window.crypto) => {
  if (!cryptoImpl || !cryptoImpl.subtle) {
    throw new Error('PKCE requires the Web Crypto API.');
  }
  const verifierBytes = new Uint8Array(32);
  cryptoImpl.getRandomValues(verifierBytes);
  const verifier = toBase64Url(verifierBytes);
  const verifierData = Uint8Array.from(verifier, char => char.charCodeAt(0));
  const challengeDigest = await cryptoImpl.subtle.digest('SHA-256', verifierData);
  return {
    challenge: toBase64Url(new Uint8Array(challengeDigest)),
    verifier,
  };
};
