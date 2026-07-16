import createDOMPurify from 'dompurify';

const domPurify = createDOMPurify(window);
const urlParsingNode = window.document.createElement('a');
const uriAttributes = new Set([
  'action',
  'background',
  'cite',
  'formaction',
  'href',
  'longdesc',
  'poster',
  'src',
  'usemap',
  'xlink:href',
]);
const activeFormTags = ['button', 'form', 'input', 'option', 'select', 'textarea'];
const commentPrefix = '\uE000stackedit-comment-';
const commentSuffix = '\uE001';

function sanitizeUri(uri, isImage) {
  const value = `${uri || ''}`.trim();
  if (isImage && /^(?:blob:|data:image\/(?:gif|jpe?g|png|webp);base64,)/i.test(value)) {
    return uri;
  }
  urlParsingNode.setAttribute('href', value);
  const normalizedValue = urlParsingNode.href;
  const allowedPattern = isImage
    ? /^https?:/i
    : /^(?:https?|mailto|tel):/i;
  if (normalizedValue !== '' && !allowedPattern.test(normalizedValue)) {
    return `unsafe:${normalizedValue}`;
  }
  return uri;
}

domPurify.addHook('uponSanitizeAttribute', (node, data) => {
  const attributeName = data.attrName.toLowerCase();
  if (attributeName === 'srcdoc'
    || attributeName === 'srcset'
    || attributeName === 'style'
    || attributeName.startsWith('on')) {
    data.keepAttr = false;
    return;
  }
  if (!uriAttributes.has(attributeName)) {
    return;
  }
  const tagName = node.tagName.toLowerCase();
  if (attributeName === 'xlink:href') {
    data.keepAttr = /^#[A-Za-z][\w:.-]*$/.test(data.attrValue);
    return;
  }
  const isImage = (tagName === 'img' && attributeName === 'src')
    || attributeName === 'background';
  data.keepAttr = !/^unsafe:/.test(sanitizeUri(data.attrValue, isImage));
});

domPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (node.tagName === 'IFRAME') {
    node.setAttribute('loading', 'lazy');
    node.setAttribute('referrerpolicy', 'no-referrer');
    node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  }
});

function sanitizeHtml(html) {
  const comments = [];
  const htmlWithCommentTokens = `${html || ''}`.replace(/<!--([\s\S]*?)-->/g, (match, comment) => {
    const token = `${commentPrefix}${comments.length}${commentSuffix}`;
    comments.push(comment);
    return token;
  });
  let sanitizedHtml = domPurify.sanitize(htmlWithCommentTokens, {
    ADD_ATTR: ['allowfullscreen', 'loading', 'referrerpolicy', 'sandbox', 'target'],
    ADD_TAGS: ['iframe'],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['srcdoc', 'srcset', 'style'],
    FORBID_TAGS: ['embed', 'object', 'script', 'style', ...activeFormTags],
  });
  comments.forEach((comment, index) => {
    const token = `${commentPrefix}${index}${commentSuffix}`;
    const safeComment = comment.replace(/--/g, '&#45;&#45;');
    sanitizedHtml = sanitizedHtml.replace(token, `<!--${safeComment}-->`);
  });
  return sanitizedHtml;
}

export default {
  sanitizeHtml,
  sanitizeUri,
};
