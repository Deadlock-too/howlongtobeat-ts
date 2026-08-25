---
'howlongtobeat-ts': patch
---

Point the search and init requests at HowLongToBeat's current endpoints

HowLongToBeat moved its API again: `api/bleed` and `api/bleed/init` no longer serve
the search and init payloads, so every `search` and `searchOne` call failed against
the live site. They now use `api/search/site` and `api/search/site/init`.

No public API changes — `HowLongToBeatService.SEARCH_URL` and `INIT_URL` are still
the override points if the endpoints move again.

The unit suite's fetch doubles now derive their route matchers from those two
constants instead of hardcoding a path fragment, so the next move only has to be
made in one place.
