const defaultMaxConcurrent = 2;
const defaultMaxInputBytes = 5 * 1024 * 1024;

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

exports.maxConcurrent = toPositiveInteger(
  process.env.EXPORT_MAX_CONCURRENT,
  defaultMaxConcurrent,
);
exports.maxInputBytes = toPositiveInteger(
  process.env.EXPORT_MAX_INPUT_BYTES,
  defaultMaxInputBytes,
);

exports.createGuard = ({
  maxConcurrent = exports.maxConcurrent,
  maxInputBytes = exports.maxInputBytes,
} = {}) => {
  let activeExports = 0;

  return (req, res, next) => {
    const contentLength = Number.parseInt(req.headers['content-length'], 10);
    if (Number.isFinite(contentLength) && contentLength > maxInputBytes) {
      res.status(413).send('Export input is too large.');
      return;
    }
    if (activeExports >= maxConcurrent) {
      res.set('Retry-After', '5');
      res.status(503).send('Export capacity is currently exhausted.');
      return;
    }

    activeExports += 1;
    req.exportMaxInputBytes = maxInputBytes;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        activeExports -= 1;
      }
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
};
