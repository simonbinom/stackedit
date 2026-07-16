const exportErrors = require('./exportErrors');

exports.read = (req, maxBytes) => new Promise((resolve, reject) => {
  const chunks = [];
  let bytes = 0;
  let settled = false;

  const cleanup = () => {
    req.removeListener('aborted', onAborted);
    req.removeListener('data', onData);
    req.removeListener('end', onEnd);
    req.removeListener('error', onError);
  };
  const finish = (err, value) => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    if (err) {
      req.resume();
      reject(err);
    } else {
      resolve(value);
    }
  };
  const onAborted = () => finish(exportErrors.create('REQUEST_ABORTED'));
  const onData = (chunk) => {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      finish(exportErrors.create('PAYLOAD_TOO_LARGE'));
    } else {
      chunks.push(chunk);
    }
  };
  const onEnd = () => finish(undefined, Buffer.concat(chunks));
  const onError = () => finish(exportErrors.create('INVALID_EXPORT_INPUT'));

  req.on('aborted', onAborted);
  req.on('data', onData);
  req.on('end', onEnd);
  req.on('error', onError);
});
