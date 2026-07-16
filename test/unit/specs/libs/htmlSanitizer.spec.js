import htmlSanitizer from '../../../../src/libs/htmlSanitizer';

describe('HTML sanitizer', () => {
  test('removes active content and unsafe URLs', () => {
    const html = htmlSanitizer.sanitizeHtml(`
      <script>alert(1)</script>
      <form><input autofocus></form>
      <a href="javascript:alert(1)" onclick="alert(1)" style="color:red">link</a>
      <img src="data:image/svg+xml;base64,PHN2Zz4=" srcset="https://example.com/a.png 1x">
    `);

    expect(html).not.toMatch(/script|form|input|javascript|onclick|style=|srcset|data:image/i);
    expect(html).toContain('<a>link</a>');
  });

  test('preserves Markdown HTML and safe comments', () => {
    const html = htmlSanitizer.sanitizeHtml(
      '<!-- toc --><h2 id="topic">Topic</h2><a href="https://example.com" target="_blank">link</a>',
    );

    expect(html).toContain('<!-- toc -->');
    expect(html).toContain('<h2 id="topic">Topic</h2>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test('sandboxes allowed HTTPS iframes', () => {
    const html = htmlSanitizer.sanitizeHtml(
      '<iframe src="https://www.youtube.com/embed/example" srcdoc="<script></script>" allowfullscreen></iframe>',
    );

    expect(html).toContain('src="https://www.youtube.com/embed/example"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).not.toContain('srcdoc');
  });

  test('only permits raster data images', () => {
    expect(htmlSanitizer.sanitizeUri('data:image/png;base64,AAAA', true))
      .toBe('data:image/png;base64,AAAA');
    expect(htmlSanitizer.sanitizeUri('data:image/svg+xml;base64,AAAA', true))
      .toMatch(/^unsafe:/);
  });
});
