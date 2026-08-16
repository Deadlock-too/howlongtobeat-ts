// Verifies the published ESM entrypoint loads and exports the public API.
import assert from 'node:assert'
import { HowLongToBeatService, HttpError, ScraperError, SearchModifier } from '../dist/index.mjs'

assert.strictEqual(typeof HowLongToBeatService, 'function')
assert.strictEqual(typeof new HowLongToBeatService().search, 'function')
assert.ok('HIDE_DLC' in SearchModifier)
assert.ok(new HttpError('boom', 403) instanceof ScraperError)
assert.strictEqual(new HttpError('boom', 403).status, 403)
console.log('ESM smoke test passed')
