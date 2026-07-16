const auth = require('../../../../server/auth');
const github = require('../../../../server/github');

describe('server authentication boundaries', () => {
  test('accepts ID tokens only from a Bearer authorization header', () => {
    expect(auth.getBearerToken({
      get: () => 'Bearer header-token',
      query: { idToken: 'query-token' },
    })).toBe('header-token');
    expect(auth.getBearerToken({
      get: () => '',
      query: { idToken: 'query-token' },
    })).toBeNull();
  });

  test('rejects an invalid GitHub authorization code before token exchange', () => {
    const response = {
      send: jest.fn(),
      set: jest.fn(),
      status: jest.fn(),
    };
    response.status.mockReturnValue(response);

    github.githubToken({ body: { code: 'code' } }, response);

    expect(response.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith('bad_code');
  });

  test('exchanges a GitHub code using the PKCE verifier', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => Promise.resolve({
      json: () => Promise.resolve({ access_token: 'access-token' }),
      ok: true,
    }));
    const response = {
      send: jest.fn(),
      set: jest.fn(),
      status: jest.fn(),
    };
    response.status.mockReturnValue(response);

    try {
      await github.githubToken({
        body: {
          code: 'authorization-code',
          codeVerifier: 'a'.repeat(43),
        },
      }, response);

      const request = global.fetch.mock.calls[0][1];
      expect(request.body.get('code_verifier')).toBe('a'.repeat(43));
      expect(request.headers.Accept).toBe('application/json');
      expect(response.send).toHaveBeenCalledWith('access-token');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
