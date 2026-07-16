class ExportError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

exports.ExportError = ExportError;
exports.create = code => new ExportError(code);
