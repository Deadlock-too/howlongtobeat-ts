# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`howlongtobeat-ts` is a TypeScript library published to npm as `howlongtobeat-ts`. It scrapes HowLongToBeat, which has no official API and changes without notice, on top of `@deadlock-too/scrape-kit` — the shared fetch client, title matching and result model, which lives in its own repository and is changed there, not patched around here.

Ideas for this library live in Index (index.ppt.fyi), Stefan's project manager, and not in this repository.

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

**Work reaches `main` through a pull request, and the owner merges it.** An agent working in this repository commits on a branch of its own, pushes that branch, and opens a pull request against `main`: it never pushes to `main`, and it never merges a pull request, its own or the "Version Packages" one included. The branch is named `<type>/<id>-<slug>`: `feat`, `fix`, `chore`, `docs` or `deps` for the type, the id of the Index idea it implements, and a few words of the idea's title in kebab-case (`feat/12-login-github`). Work with no idea behind it drops the id (`chore/node-24`). The name is the owner's standing instruction and overrides the `claude/…` branch a session is started on: create the named branch from `origin/main` before the first commit. One branch holds one piece of work. Its description says what changed and how it was verified. Work that comes from an idea in Index is linked to it with the MCP tool `link_pull_request` as soon as the pull request exists, so the merge closes the idea.

**The owner merges with "Rebase and merge".** GitHub replays the branch onto `main` keeping each commit's author and author date, and the branch is deleted after the merge.

**Every commit is the owner's.** The author _and_ the committer of every commit on the branch are the owner, `Deadlock-too`, with the address of the owner's own commits (`git log --author='^Deadlock-too <' -1 --format='%an <%ae>'`, not the `users.noreply.github.com` address a merge on GitHub records) — older commits in this history authored by `Claude` are the thing this rule replaced, not a precedent. The only acknowledgement an agent gets is a `Co-Authored-By` trailer naming the model and nothing else: no session URL, no harness name. A harness may export `GIT_AUTHOR_NAME` and `GIT_AUTHOR_EMAIL`, which beat `.git/config`, so committing as the owner may take `env -u` on all four `GIT_*` identity variables plus an explicit `--author=`; and a global `commit.gpgsign=true` signs with a key that is not the owner's, so turn it off in the clone (`git config commit.gpgsign false`).

**Commit titles follow the history: `type: summary`** (`feat`, `fix`, `test`, `ci`, `docs`, `chore`), in the imperative. **A paragraph in a commit message is one line, however long** — no hard wrapping, since `git log` and GitHub reflow a body themselves. Never commit with `--no-verify`. A history rewrite keeps each commit's original timestamps: `git rebase --committer-date-is-author-date`, and compare `git log --format='%h %aI %cI %s'` before and after.
