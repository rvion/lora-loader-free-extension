# lora-loader-free-extension

A Chrome (MV3) extension for civitai.com model pages. A floating card shows
whether the version on screen is already in the local LoRA Manager library
(ComfyUI plugin or standalone), and lets you download it into a chosen
root and subfolder in one click, or mark it for a later batch download from
the popup. It talks only to LoRA Manager's open source HTTP API. Stack:
TypeScript, React 19 + MobX 7 (`obs()` from rvlib-mobx), bundled by
`bun build` into `dist/`.

## Quick start

- `bun run build` → `dist/`, then chrome://extensions → Developer mode →
  Load unpacked → pick `dist/`. After a rebuild, press reload on the card.
- `bun run hub` → the repo toolbox at http://localhost:4913
- `shipkit ci` → THE gate: run it to check your work, never the parts

This folder is the project's internal wiki and its SPEC. Update the page
BEFORE the change it describes.

**Always loaded every session:**

@coding.md

Read the matching page before touching a surface:

| read when touching… | page |
|---|---|
| any source file | `agent/coding.md` |
| what the user sees, card and popup behaviour | `agent/spec.md` |
| module layout, message flow, why the background owns every LM call | `agent/architecture.md` |
| any call to LoRA Manager or Civitai | `agent/lora-manager-api.md` |
| recent changes and why | `agent/changelog.md` |
