# Changelog

## Unreleased (minor)

- Every Civitai model card (home, search, tag pages, creators) shows
  "✓ LM" when the model is in your library, or a one click "⬇ Install" that
  downloads its latest version, with live progress on the card.
- Tag rules: map a Civitai tag to a root and subfolder from the bar on any
  tag page. Rules apply everywhere by the model's tags, first rule wins, and
  can be reordered in the popup.
- Dock and free mode for the card and the tag bar. Docked, the card sits in
  Civitai's right rail (in place of the rail ad) and the tag bar becomes its
  own strip under Civitai's header. Free, they float wherever you drag
  them, and the spot is saved. ⇱ undocks, ⇲ docks again and says so when the
  page has no spot for it.
- Much louder look: glowing gradients with a slow, GPU cheap pulse, green
  for "have it", red and orange for "get it".
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
