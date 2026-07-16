const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const exportInput = require('../../../../server/exportInput');
const exportSecurity = require('../../../../server/exportSecurity');

const createResponse = () => {
  const response = new EventEmitter();
  response.set = jest.fn(() => response);
  response.status = jest.fn(() => response);
  response.send = jest.fn(() => response);
  return response;
};

describe('export security', () => {
  test('rejects an oversized request before starting an export', () => {
    const guard = exportSecurity.createGuard({
      maxConcurrent: 1,
      maxInputBytes: 10,
    });
    const response = createResponse();
    const next = jest.fn();

    guard({ headers: { 'content-length': '11' } }, response, next);

    expect(response.status).toHaveBeenCalledWith(413);
    expect(next).not.toHaveBeenCalled();
  });

  test('limits concurrency and releases capacity when a response finishes', () => {
    const guard = exportSecurity.createGuard({
      maxConcurrent: 1,
      maxInputBytes: 10,
    });
    const firstResponse = createResponse();
    const secondResponse = createResponse();
    const thirdResponse = createResponse();
    const firstNext = jest.fn();
    const secondNext = jest.fn();
    const thirdNext = jest.fn();

    guard({ headers: {} }, firstResponse, firstNext);
    guard({ headers: {} }, secondResponse, secondNext);
    firstResponse.emit('finish');
    guard({ headers: {} }, thirdResponse, thirdNext);

    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(secondResponse.status).toHaveBeenCalledWith(503);
    expect(secondNext).not.toHaveBeenCalled();
    expect(thirdNext).toHaveBeenCalledTimes(1);
  });

  test('stops chunked input after the configured byte limit', async () => {
    const request = new PassThrough();
    const inputPromise = exportInput.read(request, 4);
    request.end(Buffer.from('12345'));

    await expect(inputPromise).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
    });
  });
});
