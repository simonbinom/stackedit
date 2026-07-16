import createPkce from '../../../../src/services/pkce';

describe('PKCE', () => {
  test('creates an S256-compatible verifier and challenge', async () => {
    const cryptoImpl = {
      getRandomValues: jest.fn((bytes) => {
        bytes.forEach((value, index) => {
          bytes[index] = index;
        });
        return bytes;
      }),
      subtle: {
        digest: jest.fn(() => Promise.resolve(Uint8Array.from({ length: 32 },
          (value, index) => 255 - index).buffer)),
      },
    };

    const result = await createPkce(cryptoImpl);

    expect(result.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cryptoImpl.subtle.digest).toHaveBeenCalledWith(
      'SHA-256',
      Uint8Array.from(result.verifier, char => char.charCodeAt(0)),
    );
  });

  test('refuses to downgrade without Web Crypto', async () => {
    await expect(createPkce({})).rejects.toThrow('Web Crypto');
  });
});
