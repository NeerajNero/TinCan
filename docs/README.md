# Tincan documentation

Everything about how Tincan is built and how to change it. `CLAUDE.md` at the repo root is the product spec and the rules an engineer (human or AI) must follow; these pages describe the codebase as it actually is.

| Page | Read it when |
| --- | --- |
| [architecture.md](architecture.md) | You want the shape of the app: stack, providers, data flow, realtime layers, listener budget |
| [data-model.md](data-model.md) | You're touching Firestore or RTDB: every collection and node, who writes it, how it's bounded |
| [features.md](features.md) | You need to find the code for a screen or understand what it does |
| [api.md](api.md) | You're calling or changing an API route |
| [security.md](security.md) | Rules, the API guard, signed uploads, CSP, tests |
| [operations.md](operations.md) | Env, scripts, deploy, cron, Cloudinary, radio stations, resets, health checks |
| [conventions.md](conventions.md) | Code style and the patterns every file follows (including the lint rules that bite) |
| [adding-a-feature.md](adding-a-feature.md) | Step-by-step for a new screen, collection, push type, or game |
| [testing.md](testing.md) | Rules tests and the manual checklists |
| [troubleshooting.md](troubleshooting.md) | An error you've seen before, probably |
| [../CHANGELOG.md](../CHANGELOG.md) | What changed, phase by phase |

**Keeping docs honest.** Every change that adds, removes or alters behaviour updates the relevant page here and adds a line to `CHANGELOG.md` in the same commit. The rule lives in `CLAUDE.md` → Engineering rules, so it applies to every future session.
