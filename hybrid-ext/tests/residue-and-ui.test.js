import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url)
const optionsJs = readFileSync(new URL('src/options/options.js', root), 'utf8')
const optionsHtml = readFileSync(new URL('src/options/options.html', root), 'utf8')
const docsReadme = readFileSync(new URL('docs/README.md', root), 'utf8')
const retiredModel = ['gpt', '4o', 'mini'].join('-')
const retiredVendor = ['open', 'ai'].join('')
const retiredProtocol = ['chat', 'completions'].join('-')
const retiredLabel = ['cloud', retiredVendor, 'compat'].join('-')
const retiredPattern = new RegExp(
  [retiredModel, 'DEFAULT_CLOUD', retiredVendor, retiredProtocol, retiredLabel].join('|'),
  'i'
)
const staleScreenshot = ['popup', 'png'].join('.')

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:js|html|md|json)$/.test(entry.name) ? [path] : []
  })
}

test('options page has no retired third-party model default', () => {
  assert.doesNotMatch(optionsJs, retiredPattern)
})

test('extension docs and source have no retired vendor-compatible residue', () => {
  for (const path of sourceFiles(new URL('src', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
    const text = readFileSync(path, 'utf8')
    assert.doesNotMatch(text, retiredPattern, path)
  }
  assert.doesNotMatch(docsReadme, retiredPattern)
})

test('stale popup screenshot reference and asset are removed', () => {
  assert.doesNotMatch(docsReadme, new RegExp(staleScreenshot.replace('.', '\\.'), 'i'))
  assert.equal(existsSync(new URL(`docs/${staleScreenshot}`, root)), false)
})

test('options UI marks appId required and exposes App Check production/debug settings', () => {
  assert.match(optionsHtml, /id="firebase-app-id"[^>]*required/)
  assert.doesNotMatch(optionsHtml, /App ID \(optional\)/)
  assert.match(optionsHtml, /id="firebase-appcheck-endpoint"/)
  assert.match(optionsHtml, /id="appcheck-debug"/)
  assert.match(optionsHtml, /id="firebase-appcheck-debug-token"/)
  assert.match(optionsHtml, /id="config-error"/)
})

test('options save reports validation errors and persists the debug token without forcing debug mode', () => {
  assert.match(optionsJs, /config-error/)
  assert.match(optionsJs, /catch\s*\(/)
  assert.match(optionsJs, /appcheck_debug_token/)
  assert.doesNotMatch(optionsJs, /appcheck_debug:\s*true/)
})
