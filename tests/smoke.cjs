// Verifies the published CommonJS entrypoint loads and exports the public API.
const assert = require('node:assert')
const { HowLongToBeatService, HttpError, ScraperError, SearchModifier } = require('../dist/index.cjs')

assert.strictEqual(typeof HowLongToBeatService, 'function')
assert.strictEqual(typeof new HowLongToBeatService().search, 'function')
assert.ok('HIDE_DLC' in SearchModifier)
assert.ok(new HttpError('boom', 403) instanceof ScraperError)
assert.strictEqual(new HttpError('boom', 403).status, 403)
console.log('CJS smoke test passed')
