const user = require('./user');
const conf = require('./conf');
const exportDocumentPolicy = require('./exportDocumentPolicy');
const exportErrors = require('./exportErrors');
const exportInput = require('./exportInput');
const exportProcess = require('./exportProcess');

const authorizedPageSizes = [
  'A3',
  'A4',
  'Legal',
  'Letter',
];

const readJson = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
};

const numberOption = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const addTextOption = (params, name, value) => {
  if (value != null && `${value}`.length) {
    params.push(name, `${value}`.slice(0, 256));
  }
};

const buildParams = (options) => {
  const params = [
    '-T', numberOption(options.marginTop, 25, 0, 100),
    '-R', numberOption(options.marginRight, 25, 0, 100),
    '-B', numberOption(options.marginBottom, 25, 0, 100),
    '-L', numberOption(options.marginLeft, 25, 0, 100),
  ];

  addTextOption(params, '--header-center', options.headerCenter);
  addTextOption(params, '--header-left', options.headerLeft);
  addTextOption(params, '--header-right', options.headerRight);
  addTextOption(params, '--header-font-name', options.headerFontName);
  if (options.headerFontSize != null) {
    params.push('--header-font-size', numberOption(options.headerFontSize, 12, 1, 72));
  }
  addTextOption(params, '--footer-center', options.footerCenter);
  addTextOption(params, '--footer-left', options.footerLeft);
  addTextOption(params, '--footer-right', options.footerRight);
  addTextOption(params, '--footer-font-name', options.footerFontName);
  if (options.footerFontSize != null) {
    params.push('--footer-font-size', numberOption(options.footerFontSize, 12, 1, 72));
  }

  params.push('--page-size', authorizedPageSizes.includes(options.pageSize) ? options.pageSize : 'A4');
  params.push('--disable-javascript');
  params.push('--disable-local-file-access');
  return params;
};

exports.generate = async (req, res) => {
  try {
    if (!await user.checkSponsor(user.getIdToken(req))) {
      throw exportErrors.create('UNAUTHORIZED');
    }
    const input = await exportInput.read(req, req.exportMaxInputBytes);
    const validatedInput = await exportDocumentPolicy.validateHtml(input);
    const { filePath, cleanupCallback } = await exportProcess.createTempFile();
    const params = buildParams(readJson(req.query.options));
    await exportProcess.run({
      args: params.concat('-', filePath),
      cleanupCallback,
      command: conf.values.wkhtmltopdfPath,
      contentType: 'application/pdf',
      filePath,
      input: validatedInput,
      res,
    });
  } catch (err) {
    exportProcess.sendError(res, err, 'wkhtmltopdf');
  }
};

exports.buildParams = buildParams;
