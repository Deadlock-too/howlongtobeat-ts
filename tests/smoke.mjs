// Verifies the published ESM entrypoint loads and exports the public API.
import assert from 'node:assert'
import { HowLongToBeatService, SearchModifier } from '../dist/index.mjs'

assert.strictEqual(typeof HowLongToBeatService, 'function')
assert.strictEqual(typeof new HowLongToBeatService().search, 'function')
assert.ok('HIDE_DLC' in SearchModifier)
console.log('ESM smoke test passed')
