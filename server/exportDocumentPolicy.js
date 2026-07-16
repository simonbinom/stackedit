const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');
const parse5 = require('parse5');
const exportErrors = require('./exportErrors');

const defaultRemoteHosts = 'stackedit.io';
const forbiddenElements = new Set([
  'base',
  'embed',
  'frame',
  'iframe',
  'object',
  'script',
]);
const resourceHrefElements = new Set([
  'feimage',
  'image',
  'link',
  'use',
]);
const resourceAttributes = new Set([
  'background',
  'poster',
  'src',
]);
const blockedMetadata = new Set([
  'bibliography',
  'csl',
  'header-includes',
  'include-after',
  'include-before',
  'template',
]);
const benchmarkRange = ipaddr.parseCIDR('198.18.0.0/15');

const fail = code => {
  throw exportErrors.create(code);
};

const normalizeAllowedHosts = (allowedHosts) => {
  const value = allowedHosts == null
    ? process.env.EXPORT_REMOTE_HOSTS || defaultRemoteHosts
    : allowedHosts;
  return (Array.isArray(value) ? value : `${value}`.split(','))
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
};

const isAllowedHost = (hostname, allowedHosts) => allowedHosts.some((allowedHost) => {
  if (allowedHost === '*') {
    return true;
  }
  if (allowedHost.startsWith('*.')) {
    return hostname.endsWith(allowedHost.slice(1));
  }
  return hostname === allowedHost;
});

const isPublicAddress = (address) => {
  let parsedAddress;
  try {
    parsedAddress = ipaddr.process(address.replace(/%.+$/, ''));
  } catch (err) {
    return false;
  }
  if (parsedAddress.kind() === 'ipv4' && parsedAddress.match(benchmarkRange)) {
    return false;
  }
  return parsedAddress.range() === 'unicast';
};

const parseRemoteUrl = (rawUrl) => {
  const value = `${rawUrl || ''}`.trim();
  if (!value || value.startsWith('#')) {
    return undefined;
  }
  if (/^data:/i.test(value)) {
    if (/^data:image\/(?:gif|jpe?g|png|webp);base64,/i.test(value)) {
      return undefined;
    }
    fail('EXPORT_RESOURCE_BLOCKED');
  }

  let url;
  try {
    url = value.startsWith('//') ? new URL(`https:${value}`) : new URL(value);
  } catch (err) {
    // Relative URLs and document anchors don't cause cross-origin requests.
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail('EXPORT_RESOURCE_BLOCKED');
  }
  if (url.username || url.password) {
    fail('EXPORT_RESOURCE_BLOCKED');
  }
  return url;
};

const collectCssUrls = (css, urls) => {
  const value = `${css || ''}`;
  if (/\\|expression\s*\(|(?:-moz-binding|behavior)\s*:/i.test(value)) {
    fail('EXPORT_ACTIVE_CONTENT');
  }
  value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, url) => {
    urls.add(url);
    return match;
  });
  value.replace(/@import\s+(['"])(.*?)\1/gi, (match, quote, url) => {
    urls.add(url);
    return match;
  });
};

const collectHtmlUrls = (html) => {
  const document = parse5.parse(html);
  const urls = new Set();
  const stack = [document];

  while (stack.length) {
    const node = stack.pop();
    const tagName = `${node.tagName || ''}`.toLowerCase();
    if (forbiddenElements.has(tagName)) {
      fail('EXPORT_ACTIVE_CONTENT');
    }

    const attributes = node.attrs || [];
    const attributesByName = Object.create(null);
    attributes.forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      attributesByName[attributeName] = attribute.value;
      if (attributeName.startsWith('on') || attributeName === 'srcdoc') {
        fail('EXPORT_ACTIVE_CONTENT');
      }
      if (attributeName === 'style') {
        collectCssUrls(attribute.value, urls);
      } else if (attributeName === 'srcset') {
        fail('EXPORT_RESOURCE_BLOCKED');
      } else if (resourceAttributes.has(attributeName)
        || (attributeName === 'href' && resourceHrefElements.has(tagName))) {
        urls.add(attribute.value);
      } else if (attributeName === 'href' && /^\s*(?:data|file|javascript):/i.test(attribute.value)) {
        fail('EXPORT_ACTIVE_CONTENT');
      }
    });

    if (tagName === 'meta'
      && `${attributesByName['http-equiv'] || ''}`.toLowerCase() === 'refresh') {
      fail('EXPORT_ACTIVE_CONTENT');
    }
    if (tagName === 'style') {
      (node.childNodes || []).forEach((childNode) => {
        if (childNode.nodeName === '#text') {
          collectCssUrls(childNode.value, urls);
        }
      });
    }
    (node.childNodes || []).forEach(childNode => stack.push(childNode));
  }

  return urls;
};

const validateRemoteUrls = async (urls, {
  allowedHosts,
  lookup = dns.lookup,
} = {}) => {
  const normalizedAllowedHosts = normalizeAllowedHosts(allowedHosts);
  const hostValidationPromises = new Map();
  const parsedUrls = [...urls]
    .map(parseRemoteUrl)
    .filter(Boolean);
  if (parsedUrls.length > 100) {
    fail('EXPORT_RESOURCE_BLOCKED');
  }

  await Promise.all(parsedUrls.map(async (url) => {
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!isAllowedHost(hostname, normalizedAllowedHosts)) {
      fail('EXPORT_RESOURCE_BLOCKED');
    }
    if (!hostValidationPromises.has(hostname)) {
      hostValidationPromises.set(hostname, Promise.resolve()
        .then(() => lookup(hostname, { all: true, verbatim: true }))
        .then((records) => {
          const addresses = (Array.isArray(records) ? records : [records])
            .map(record => record && record.address)
            .filter(Boolean);
          if (!addresses.length || addresses.some(address => !isPublicAddress(address))) {
            fail('EXPORT_RESOURCE_BLOCKED');
          }
        })
        .catch((err) => {
          if (err && err.code === 'EXPORT_RESOURCE_BLOCKED') {
            throw err;
          }
          fail('EXPORT_RESOURCE_BLOCKED');
        }));
    }
    await hostValidationPromises.get(hostname);
  }));
};

exports.validateHtml = async (input, options) => {
  const html = Buffer.isBuffer(input) ? input.toString('utf8') : `${input}`;
  await validateRemoteUrls(collectHtmlUrls(html), options);
  return Buffer.from(html);
};

exports.validatePandoc = async (input, options) => {
  let document;
  try {
    document = JSON.parse(Buffer.isBuffer(input) ? input.toString('utf8') : `${input}`);
  } catch (err) {
    fail('INVALID_EXPORT_INPUT');
  }
  if (!document || !Array.isArray(document.blocks) || !Array.isArray(document['pandoc-api-version'])) {
    fail('INVALID_EXPORT_INPUT');
  }

  const urls = new Set();
  const stack = [document];
  let nodeCount = 0;
  while (stack.length) {
    const value = stack.pop();
    nodeCount += 1;
    if (nodeCount > 100000) {
      fail('INVALID_EXPORT_INPUT');
    }
    if (Array.isArray(value)) {
      value.forEach(child => stack.push(child));
    } else if (value && typeof value === 'object') {
      if (value.t === 'RawBlock' || value.t === 'RawInline') {
        fail('EXPORT_ACTIVE_CONTENT');
      }
      if (value.t === 'Image'
        && Array.isArray(value.c)
        && Array.isArray(value.c[2])
        && value.c[2][0]) {
        urls.add(value.c[2][0]);
      }
      Object.values(value).forEach(child => stack.push(child));
    }
  }
  await validateRemoteUrls(urls, options);
  return Buffer.from(JSON.stringify(document));
};

exports.sanitizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return Object.entries(metadata).slice(0, 32).reduce((result, [key, value]) => {
    const normalizedKey = `${key}`.toLowerCase();
    if (blockedMetadata.has(normalizedKey)) {
      fail('EXPORT_ACTIVE_CONTENT');
    }
    if (/^[a-z][a-z0-9_-]{0,63}$/i.test(key)
      && ['boolean', 'number', 'string'].includes(typeof value)) {
      result[key] = `${value}`.slice(0, 4096);
    }
    return result;
  }, {});
};

exports.validateRemoteUrls = validateRemoteUrls;
