const exportDocumentPolicy = require('../../../../server/exportDocumentPolicy');

const publicLookup = jest.fn(async () => [{ address: '104.26.14.48' }]);

describe('export document policy', () => {
  beforeEach(() => publicLookup.mockClear());

  test('allows passive HTML resources on configured public hosts', async () => {
    const input = '<link rel="stylesheet" href="https://stackedit.io/style.css"><img src="data:image/png;base64,AA==">';

    await expect(exportDocumentPolicy.validateHtml(input, {
      allowedHosts: ['stackedit.io'],
      lookup: publicLookup,
    })).resolves.toEqual(Buffer.from(input));
    expect(publicLookup).toHaveBeenCalledTimes(1);
  });

  test('rejects active HTML and unlisted remote hosts', async () => {
    await expect(exportDocumentPolicy.validateHtml('<script>alert(1)</script>'))
      .rejects.toMatchObject({ code: 'EXPORT_ACTIVE_CONTENT' });
    await expect(exportDocumentPolicy.validateHtml('<img src="https://example.com/a.png">', {
      allowedHosts: ['stackedit.io'],
      lookup: publicLookup,
    })).rejects.toMatchObject({ code: 'EXPORT_RESOURCE_BLOCKED' });
  });

  test('rejects private addresses even with a wildcard host policy', async () => {
    await expect(exportDocumentPolicy.validateHtml('<img src="http://metadata.test/a.png">', {
      allowedHosts: ['*'],
      lookup: async () => [{ address: '169.254.169.254' }],
    })).rejects.toMatchObject({ code: 'EXPORT_RESOURCE_BLOCKED' });
  });

  test('validates Pandoc image targets and rejects raw nodes', async () => {
    const document = {
      'pandoc-api-version': [1, 23],
      blocks: [{
        t: 'Para',
        c: [{
          t: 'Image',
          c: [['', [], []], [], ['https://stackedit.io/image.png', '']],
        }],
      }],
      meta: {},
    };
    await expect(exportDocumentPolicy.validatePandoc(JSON.stringify(document), {
      allowedHosts: ['stackedit.io'],
      lookup: publicLookup,
    })).resolves.toBeInstanceOf(Buffer);

    document.blocks = [{ t: 'RawBlock', c: ['latex', '\\input{/etc/passwd}'] }];
    await expect(exportDocumentPolicy.validatePandoc(JSON.stringify(document)))
      .rejects.toMatchObject({ code: 'EXPORT_ACTIVE_CONTENT' });
  });

  test('filters nested metadata and blocks Pandoc include directives', () => {
    expect(exportDocumentPolicy.sanitizeMetadata({
      extensions: { markdown: true },
      title: 'Document',
    })).toEqual({ title: 'Document' });
    expect(() => exportDocumentPolicy.sanitizeMetadata({
      'header-includes': '\\input{/etc/passwd}',
    })).toThrow(expect.objectContaining({ code: 'EXPORT_ACTIVE_CONTENT' }));
  });
});
