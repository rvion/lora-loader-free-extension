# Coding standards — lora-loader-free-extension

The always-loaded page. Keep it to hard gates plus a screen of standards.
Once it grows past that, split the gates into `process.md`, make that the
always-loaded one, and route the rest by surface.

## Gates

- **Spec-first**: the `agent/` page changes BEFORE the code it describes.
- **`shipkit ci` is the verification.** Run it, not the linter, the
  typechecker and the tests one at a time.
- **Repro before fix**: write the failing test, then fix, then re-run it.
- One code path per concern. Delete the redundant mechanism rather than
  keeping two.

## TypeScript

- `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`: all on, always.
- No `as any`, no `@ts-ignore`. A cast that survives review is listed here
  with the reason it is safe.
- Imports are absolute (`src/...`), never `../..` chains.

## Comments

- The default is NO comment. Write one only for what the code cannot say:
  a constraint, an invariant, a performance reason, a workaround.
- Never narrate the edit, the date, or who asked for it. That is what git
  and the changelog are for.
- Lowercase, no dash punctuation, matching the density of the file.

## Layout

- A file past ~600 lines is a smell; carve it at ~800.
- Anti-patterns: <fill as the project teaches them>.
