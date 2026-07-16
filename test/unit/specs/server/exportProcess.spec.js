const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const exportProcess = require('../../../../server/exportProcess');

const createChild = (exitCode) => {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = jest.fn(() => {
    child.killed = true;
  });
  process.nextTick(() => child.emit('close', exitCode));
  return child;
};

const createResponse = () => {
  const response = new PassThrough();
  response.set = jest.fn();
  return response;
};

describe('export process runner', () => {
  test('streams successful output and cleans up once', async () => {
    const output = new PassThrough();
    const cleanup = jest.fn();
    const response = createResponse();
    const runner = exportProcess.createRunner({
      createReadStream: () => {
        process.nextTick(() => {
          output.emit('open');
          output.end('pdf');
        });
        return output;
      },
      spawn: jest.fn(() => createChild(0)),
    });

    await runner({
      args: [],
      cleanupCallback: cleanup,
      command: 'converter',
      contentType: 'application/pdf',
      filePath: '/tmp/output',
      input: Buffer.from('input'),
      res: response,
      timeout: 1000,
    });

    expect(response.set).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('kills and cleans up a failed converter', async () => {
    const child = createChild(1);
    const cleanup = jest.fn();
    const runner = exportProcess.createRunner({
      spawn: jest.fn(() => child),
    });

    await expect(runner({
      args: [],
      cleanupCallback: cleanup,
      command: 'converter',
      contentType: 'application/pdf',
      filePath: '/tmp/output',
      input: Buffer.from('input'),
      res: createResponse(),
      timeout: 1000,
    })).rejects.toMatchObject({ code: 'EXPORT_FAILED' });
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
