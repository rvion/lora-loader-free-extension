# Changelog

## Unreleased (minor)

- Every Civitai model card (home, search, tag pages, creators) shows
  "✓ LM" when the model is in your library, or a one click "⬇ Install" that
  downloads its latest version, with live progress on the card.
- Tag rules: map a Civitai tag to a root and subfolder from the bar on any
  tag page. Rules apply everywhere by the model's tags, first rule wins, and
  can be reordered in the popup.
- Dock and free mode for the card and the tag bar. Docked, each becomes its
  own strip under Civitai's header (the card as one compact row), which
  stays at every window width, mobile included. Free, they float wherever you drag
  them, and the spot is saved. ⇱ undocks, ⇲ docks again and says so when the
  page has no spot for it.
- Civitai's ads are removed, visibly: a red ring and a "✕ ad removed" label,
  then they fade out.
- Much louder look: glowing gradients with a slow, GPU cheap pulse, green
  for "have it", red and orange for "get it".
- Subfolder picker that works like a select: it lists every folder LoRA
  Manager knows, filters as you type, and still takes any new path.
- The model page shows the same chips as the tiles; click a chip's folder
  part to change where that one goes (and which file), on tiles too. When
  LoRA Manager is down, the chips mark versions for Download all instead.
- The bar is left aligned on every page.
- Listing cards get one chip per base model (Krea 2, Anima, Illustrious, …)
  saying which you have, which have a newer version, and where each missing
  one would install: "⬇ Anima [loras] (anima/styles)".
- Rules: conditions on tags, name or tag text, base model and type, pick
  the default folder; {base} in the subfolder splits by base model. A bar on
  every Civitai page opens them in a popover, pre filled from the tag page
  or search you are on, with a live preview on every install chip.
- A rule for each Civitai category (character, style, concept, …) is added
  at first run, sending each to {base}/<category>; + Categories adds back
  any you deleted.
- Focus: show install chips only for the base models, types or tags you
  care about.
- Install chips are see through, with a small pulsing dot, so the picture
  stays visible.
- Newer versions are flagged: "⬆ NEWER VERSION" on listing cards (one click
  installs it) and "⬆ NEWER" on the card, counting only a later version for
  the same base model.
- Hovering a listing chip shows which versions you have and where.
- Root pickers show real root names ("loras") and list every root.
- Version chip on the card: hover for base model and file, click to pick
  another version to download.
- In library, the card shows where: `loras › krea2/styles` and the file
  name, with a Copy button. Listing chips list the file names on hover.
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
