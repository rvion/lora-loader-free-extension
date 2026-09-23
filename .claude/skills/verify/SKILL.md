---
name: verify
description: Prove a change in THIS project actually works — drive the real flow end to end, never trust green checks or self-reports. Use before committing any nontrivial change.
---

# verify — how to PROVE a change works here


## The rules (house-wide)
- Failing repro test BEFORE the fix. Green checks ≠ verification.
- Logic → fast headless bun tests, run through `shipkit ci --only test` (tiny ~10-line test files reusing fixtures). While you fix one bug, `bun run test:raw <test file>` is the narrow way in, and one test by name is `bun run test:raw -- -t "<name>"`.
- Look & feel → NEVER screenshot-self-verify; the repo owner playtests it.
- Verify as the end user would: drive the real flow, observe the real signal.

## This project
- Full gate: `shipkit ci` — THE command, never the linter, the typechecker
  and the tests one at a time.
- Build: `bun run build` → `dist/`. The owner loads it unpacked in Chrome and
  playtests on a civitai.com model page. Never self verify the look.
- LoRA Manager must be up: `curl -s localhost:8188/api/lm/version-info`.
  Logic that talks to it is covered by `tests/lmClient.test.ts` with a fake
  fetch. A live server is only for a real integration bug, sandboxed per
  ComfyUI-Lora-Manager/AGENTS.md, and only with the owner's OK.
- Background errors: chrome://extensions → the card → "service worker" →
  console, lines prefixed `[lm-free]`.

## Browser verification (only when a browser is truly needed)
Playwright with explicit `executablePath`, `deviceScaleFactor: 2`, localStorage
reset between runs, `page.evaluate` probes for state, collect `pageerror`
("none" is evidence). Screenshots are for LOOKS, never for "does it fit".

## Gotchas discovered in this repo
<!-- append as found — this list is the reason this file exists -->
- (none yet)
