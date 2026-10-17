---
name: ship
description: Finish a change in Tincan the way every phase is finished. Runs the checks the change needs, updates docs and CHANGELOG in the same commit, commits, pushes, and prints the summary. Use when the user types /ship, optionally with a commit title (e.g. /ship phase 20: stickers).
disable-model-invocation: true
---

# Ship a change

Follow `docs/adding-a-feature.md` → Finish. This is the same list, in run order. The argument, if given, is the commit title; otherwise propose one in the repo's style (`phase N: name`, `area: what changed`, `docs: …`, `chore: …`) and use it.

## 1. See what changed

`git status --short` and `git diff --stat` (plus `git diff` for anything unclear). Work out which areas were touched: UI, `src/lib`, rules templates, `csp.ts` / `next.config.ts` / `src/proxy.ts`, `src/app/sw.ts`, dependencies, layout/overlays, the YouTube player, content, docs only.

If the working tree mixes unrelated changes, stop and ask what belongs in this commit.

## 2. Run the checks (stop at the first failure, fix it, re-run)

Always:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm knip` must print nothing but the `.css` configuration hint
- `pnpm test`

Also, when the change touches:

| Area | Run |
| --- | --- |
| `rules/*.tmpl` | `pnpm test:rules` (needs Java + `.env` with `ALLOWED_EMAILS`); the owner must run `pnpm rules:deploy` afterwards, so say so in the summary |
| `csp.ts`, `next.config.ts`, `src/proxy.ts`, `src/app/sw.ts`, layout, Sheet/Portal, YouTube player, dependencies | `pnpm test:e2e` (builds first). Known third-party noise is ignored by `tests/e2e/violations.ts`; any other failure is real |
| a bundle budget was asked for, or a dependency / heavy import was added | `pnpm size --compare <baseline>` with a baseline saved before the change (`git stash`, `pnpm build && pnpm size --save /tmp/size-before.json`, `git stash pop`, `pnpm build`), and report before → after |
| docs only | nothing beyond the always-list, which is fast; still run it |

Never run `pnpm rules:deploy`, `pnpm reset`, `pnpm migrate-media`, `pnpm cloudinary:presets` or `pnpm export` as part of shipping. Those are the owner's.

## 3. Docs in the same commit (hard rule from CLAUDE.md)

- Update the matching `docs/*.md` pages: `features.md` (screen → code), `data-model.md` (collections/nodes), `api.md` (routes), `security.md` (rules, CSP, headers), `operations.md` (scripts, env, procedures), `testing.md` (new tests), `troubleshooting.md` (new failure modes), `conventions.md` (new conventions).
- Add a line to `CHANGELOG.md` under today's date (create the `## YYYY-MM-DD` heading if missing, newest first). Even an internals-only fix gets a line.
- Update `CLAUDE.md` if the product or rules changed. If a phase shipped, add it to the build order.
- Update `README.md` if setup steps, scripts or the privacy table changed.
- If the change added a game, together activity or slow feature, check its entry in `src/content/howto.ts`.

## 4. Commit and push

- If on `main` and the user didn't say to commit to `main`, ask whether to branch first.
- Stage only the files that belong to this change (`git add <paths>`, not `-A`, unless the tree is exactly this change). Never stage `.env*`, `exports/`, `test-results/` or generated rules (they're gitignored; keep it that way).
- Commit with the title, a short body of what changed, and the attribution trailer the session asks for.
- `git push` (set upstream for a new branch). The remote is the backup.

## 5. Report

Print a short summary:

- what was built or fixed, and what was skipped or simplified
- which checks ran and their results (failures with output, never "should pass")
- which docs were updated (CLAUDE.md requires this line)
- anything the owner must do by hand: `pnpm rules:deploy`, env vars on Vercel, Cloudinary/Firebase console settings, a phone test list for UI changes
- bundle numbers if a budget applied
