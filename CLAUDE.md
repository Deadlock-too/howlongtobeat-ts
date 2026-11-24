# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`howlongtobeat-ts` is a TypeScript library published to npm as `howlongtobeat-ts`. It scrapes HowLongToBeat, which has no official API and changes without notice, on top of `@deadlock-too/scrape-kit` — the shared fetch client, title matching and result model, which lives in its own repository and is changed there, not patched around here.

Tasks for this library live in Index (index.ppt.fyi), Stefan's project manager, and not in this repository.

## Commands

```bash
npm run lint              # eslint
npm run format:check      # prettier --check; npm run format rewrites
npm run test:coverage     # the unit tests, against fixtures, as CI runs them (npm test without coverage)
npm run build             # tsdown: the ESM and CommonJS builds in dist/
npm run test:smoke        # build, then import the built package from ESM and from CommonJS
npm run test:integration  # against the live HowLongToBeat: network-bound and slow
npx changeset             # write the changeset a release needs (below)
```

Before opening a pull request, run what `.github/workflows/ci.yml` runs — lint, format check, unit tests with coverage, build, smoke test — and say in the description that it passed. The integration tests are not in CI: `.github/workflows/Run tests.yml` runs them against HowLongToBeat every six hours, because a scraper breaks when the site changes, not when the code does. Run them yourself when a change touches a request, a URL or a parser, and say in the pull request what they reported; a failure that is the site being down is reported as that, not fixed.

## Releases

**Releases are changesets, and nothing is published by hand.** A change that should reach npm carries a changeset in the same pull request: `npx changeset`, choosing `patch`, `minor` or `major` by what the change does to the public API, with a summary written for someone reading the changelog. When that merges, `.github/workflows/release.yml` opens or updates the "Version Packages" pull request, and merging _that_ one bumps `version`, writes `CHANGELOG.md` and publishes to npm through trusted publishing (OIDC, no token). So never run `npm publish` or `changeset publish`, and never edit `version` or `CHANGELOG.md` yourself. A change that does not touch what the package ships — tests, CI, this file — needs no changeset.

## Git

**Git follows the rules Index sends.** How a branch is named, how a pull request is opened and described, whose commits they are, what a commit message says and how a rewrite keeps its dates are written once, in the instructions the Index MCP server gives every agent connected to it (they are written down in Index's own repository), so that the owner's repositories cannot drift apart again: the branch named after the task's key (`feat/k3m9qa-login-github`), a pull request the owner merges with "Rebase and merge", the owner as author and committer with one `Co-Authored-By` trailer and no link, English commit messages, a description with no link to the session. An agent without Index connected asks the owner before its first commit. What follows is only what this repository adds to them.

**What this repository adds to them.** The "Version Packages" pull request is the owner's to merge too, like every other. The owner's address is the one on the owner's own commits, `git log --author='^Deadlock-too <' -1 --format='%an <%ae>'`, not the `users.noreply.github.com` address a merge on GitHub records, and the older commits in this history authored by `Claude` are what the rule replaced, not a precedent. A pull request's description follows `.github/pull_request_template.md`, and says that what `.github/workflows/ci.yml` runs passed.

**Commit titles follow the history: `type: summary`** (`feat`, `fix`, `test`, `ci`, `docs`, `chore`), in the imperative. Never commit with `--no-verify`.
