// Verifies the published CommonJS entrypoint loads and exports the public API.
const assert = require('node:assert')
const { HowLongToBeatService, SearchModifier } = require('../dist/index.cjs')

assert.strictEqual(typeof HowLongToBeatService, 'function')
assert.strictEqual(typeof new HowLongToBeatService().search, 'function')
assert.ok('HIDE_DLC' in SearchModifier)
console.log('CJS smoke test passed')
