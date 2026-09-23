# Changelog

## Unreleased (minor)

- Green "✓ LM" badges on every Civitai model card whose model is in your
  library, with a version count when you have several.
- File picker on the card when a version has several weight files (fp16,
  pruned, …). Marked items keep the pick.

## 1.0.0

First working version.

- Card on Civitai model pages: shows whether the version on screen is in
  your LoRA Manager library, and follows version and model changes.
- Download into a chosen root and subfolder, with live progress. The folder
  choice is remembered per model type.
- Mark versions, then Download all from the popup.
- ComfyUI address editable from the card, the popup and the Options page.
- Restart ComfyUI (through ComfyUI-Manager) with a live check that it
  stopped and came back.
