const user = require('./user');
const conf = require('./conf');
const exportDocumentPolicy = require('./exportDocumentPolicy');
const exportErrors = require('./exportErrors');
const exportInput = require('./exportInput');
const exportProcess = require('./exportProcess');

const outputFormats = {
  asciidoc: 'text/plain',
  context: 'application/x-latex',
  epub: 'application/epub+zip',
  epub3: 'application/epub+zip',
  latex: 'application/x-latex',
  odt: 'application/vnd.oasis.opendocument.text',
  pdf: 'application/pdf',
  rst: 'text/plain',
  rtf: 'application/rtf',
  textile: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const highlightStyles = [
  'pygments',
  'kate',
  'monochrome',
  'espresso',
  'zenburn',
  'haddock',
  'tango',
];

const readJson = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
};

const buildParams = (outputFormat, options, metadata) => {
  const params = [
    '--sandbox',
    '--pdf-engine=xelatex',
  ];
  if (options.toc) {
    params.push('--toc');
  }
  const tocDepth = Number.parseInt(options.tocDepth, 10);
  if (Number.isInteger(tocDepth)) {
    params.push('--toc-depth', Math.min(6, Math.max(1, tocDepth)));
  }
  const highlightStyle = highlightStyles.includes(options.highlightStyle)
    ? options.highlightStyle
    : 'kate';
  params.push('--highlight-style', highlightStyle);
  Object.entries(metadata).forEach(([key, value]) => {
    params.push('-M', `${key}=${value}`);
  });

  const format = outputFormat === 'pdf' ? 'latex' : outputFormat;
  params.push('-f', 'json', '-t', format);
  return params;
};

exports.generate = async (req, res) => {
  const outputFormat = Object.prototype.hasOwnProperty.call(outputFormats, req.query.format)
    ? req.query.format
    : 'pdf';
  try {
    if (!await user.checkSponsor(user.getIdToken(req))) {
      throw exportErrors.create('UNAUTHORIZED');
    }
    const input = await exportInput.read(req, req.exportMaxInputBytes);
    const validatedInput = await exportDocumentPolicy.validatePandoc(input);
    const metadata = exportDocumentPolicy.sanitizeMetadata(readJson(req.query.metadata));
    const params = buildParams(outputFormat, readJson(req.query.options), metadata);
    const { filePath, cleanupCallback } = await exportProcess.createTempFile({
      postfix: `.${outputFormat}`,
    });
    params.push('-o', filePath);
    await exportProcess.run({
      args: params,
      cleanupCallback,
      command: conf.values.pandocPath,
      contentType: outputFormats[outputFormat],
      filePath,
      input: validatedInput,
      res,
    });
  } catch (err) {
    exportProcess.sendError(res, err, 'Pandoc');
  }
};

exports.buildParams = buildParams;
