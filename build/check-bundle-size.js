const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '../dist')
const indexPath = path.join(distDir, 'index.html')
const limits = {
  js: Number(process.env.MAX_INITIAL_JS_BYTES) || 2.25 * 1024 * 1024,
  css: Number(process.env.MAX_INITIAL_CSS_BYTES) || 160 * 1024
}

function getInitialAssets (html) {
  return Array.from(html.matchAll(/\b(?:src|href)=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g))
    .map(match => match[1] || match[2] || match[3])
    .filter(asset => /^\/static\/.+\.(?:css|js)$/.test(asset))
}

function getSize (asset) {
  const assetPath = path.resolve(distDir, `.${asset}`)
  if (!assetPath.startsWith(`${distDir}${path.sep}`)) {
    throw new Error(`Invalid asset path: ${asset}`)
  }
  return fs.statSync(assetPath).size
}

function formatSize (bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

const html = fs.readFileSync(indexPath, 'utf8')
const assets = getInitialAssets(html)
const sizes = assets.reduce((result, asset) => {
  const extension = path.extname(asset).slice(1)
  result[extension] += getSize(asset)
  return result
}, { js: 0, css: 0 })

const failures = Object.keys(limits)
  .filter(type => sizes[type] > limits[type])
  .map(type => `${type.toUpperCase()}: ${formatSize(sizes[type])} exceeds ${formatSize(limits[type])}`)

console.log(`Initial JS: ${formatSize(sizes.js)} / ${formatSize(limits.js)}`)
console.log(`Initial CSS: ${formatSize(sizes.css)} / ${formatSize(limits.css)}`)

if (failures.length) {
  throw new Error(`Bundle size budget exceeded\n${failures.join('\n')}`)
}
