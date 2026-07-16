const childProcess = require('child_process');
const fs = require('fs');
const tmp = require('tmp');
const exportErrors = require('./exportErrors');

const defaultTimeout = 50000;

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

exports.timeout = toPositiveInteger(process.env.EXPORT_TIMEOUT_MS, defaultTimeout);

exports.createTempFile = options => new Promise((resolve, reject) => {
  tmp.file(options || {}, (err, filePath, fd, cleanupCallback) => {
    if (err) {
      reject(exportErrors.create('EXPORT_INTERNAL_ERROR'));
    } else {
      resolve({
        cleanupCallback,
        filePath,
      });
    }
  });
});

exports.createRunner = ({
  createReadStream = fs.createReadStream,
  spawn = childProcess.spawn,
} = {}) => ({
  args,
  cleanupCallback,
  command,
  contentType,
  filePath,
  input,
  res,
  timeout = exports.timeout,
}) => new Promise((resolve, reject) => {
  let child;
  let cleanedUp = false;
  let settled = false;
  let timeoutId;

  const cleanup = () => {
    if (!cleanedUp) {
      cleanedUp = true;
      cleanupCallback();
    }
  };
  const fail = (error) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timeoutId);
    if (child && !child.killed) {
      child.kill();
    }
    cleanup();
    reject(error);
  };
  const onResponseClose = () => fail(exportErrors.create('REQUEST_ABORTED'));
  res.once('close', onResponseClose);

  try {
    child = spawn(command, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
  } catch (err) {
    fail(exportErrors.create('EXPORT_INTERNAL_ERROR'));
    return;
  }
  timeoutId = setTimeout(() => {
    fail(exportErrors.create('EXPORT_TIMEOUT'));
  }, timeout);
  child.on('error', () => fail(exportErrors.create('EXPORT_INTERNAL_ERROR')));
  child.stdin.on('error', () => fail(exportErrors.create('EXPORT_FAILED')));
  child.stderr.resume();
  child.on('close', (code) => {
    if (settled) {
      return;
    }
    clearTimeout(timeoutId);
    if (code) {
      fail(exportErrors.create('EXPORT_FAILED'));
      return;
    }

    const readStream = createReadStream(filePath);
    res.set('Content-Type', contentType);
    readStream.on('open', () => readStream.pipe(res));
    readStream.on('error', () => {
      res.destroy();
      fail(exportErrors.create('EXPORT_INTERNAL_ERROR'));
    });
    readStream.on('close', () => {
      if (!settled) {
        settled = true;
        res.removeListener('close', onResponseClose);
        cleanup();
        resolve();
      }
    });
  });
  child.stdin.end(input);
});

exports.run = exports.createRunner();

exports.sendError = (res, err, converterName) => {
  if (res.headersSent || res.destroyed) {
    return;
  }
  if (err && err.code === 'UNAUTHORIZED') {
    res.status(401).send('Unauthorized.');
  } else if (err && err.code === 'EXPORT_TIMEOUT') {
    res.status(408).send('Request timeout.');
  } else if (err && err.code === 'PAYLOAD_TOO_LARGE') {
    res.status(413).send('Export input is too large.');
  } else if (err && [
    'EXPORT_ACTIVE_CONTENT',
    'EXPORT_RESOURCE_BLOCKED',
    'INVALID_EXPORT_INPUT',
  ].includes(err.code)) {
    res.status(422).send('Export input is not allowed.');
  } else if (err && err.code === 'EXPORT_FAILED') {
    res.status(400).send('Export failed.');
  } else {
    console.error(`${converterName} export failed.`); // eslint-disable-line no-console
    res.status(500).send('Export failed.');
  }
};
