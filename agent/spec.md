# Spec: what the user sees

## The card (civitai model pages)

Placement: see "Dock and free mode" below. Its dock is a full width strip
right under civitai's header (the same spot as the tag bar, which never
shows on a model page): one compact row centered like the tag bar, title,
`LM` badge, version chip, status, file, `[root] / [subfolder]` without field
labels, Download, Mark, then the tools (⇱ ⇲ ⚙) last. No title: the page
shows it right below. The floating card keeps its title and puts the tools
top right.

**Version chip** (`v1.0 ▾`): hover shows version, base model, type and the
file that will download. Click lists every version of the model (name and
base model); picking one points the card at it (status, where, file,
download) without reloading civitai's page. Changing the version on
civitai's page (the url) takes over again. It stays when the window shrinks, mobile included.
Floating default: bottom right, as a vertical card.

Appears on `https://civitai.com/models/<id>` and
`https://civitai.red/models/<id>`, for the version in `?modelVersionId=`
(else the model's first version). Follows SPA navigation: switching version
or model updates the card without a reload. Collapsible to a small pill.

The ⚙ tool opens a **popover** anchored under it (never inline: the docked
row must keep its shape) with the server URL field (same setting as the
popup: ComfyUI host, IP or full URL, e.g. `192.168.1.20:8188`) and Restart
ComfyUI. It closes on ⚙, ✕, Esc or a click outside. It also opens by itself
when LoRA Manager is unreachable; once closed it stays closed until the
address is saved again. Saving it, from the card or the popup, re-checks the
card at once.

Status line, one of:

| state | shown |
|---|---|
| checking | "Checking library…" |
| in library | green "In library" + LoRA Manager type, then **where**: each local file of that version as `root › sub/folder/file.safetensors` (root shortened to its last two segments), full path on hover, a Copy button per file |
| not in library | "Not in library" |
| downloading | progress bar with percent, or the post-transfer stage text |
| unreachable | red "LoRA Manager unreachable at <url>" + hint to open the popup |
| unsupported type | "Type <t> is not handled" (no download controls) |

Controls (hidden when in library):

- **File picker**: shown only when the version has more than one weight file
  (Civitai file types `Model`, `Pruned Model`, `Negative`, `UNet`,
  `Diffusion Model`, `Enhancement LoRA`). Each option reads
  `fp16 · pruned · SafeTensor · 2.1 GB`. Default is Civitai's primary file.
  The pick is sent as `file_params: { id }` and kept on a marked item.

- **Folder picker**: a root select (from LoRA Manager's roots for that model
  type) and a subfolder **combobox** (below). The last choice is remembered per model
  type and pre-filled.
- **Download**: starts the download into the picked root + subfolder.
- **Mark** / **Unmark**: adds or removes this version (with the picked
  folder) from the marked list.

## Newer versions

A version is **newer** than one you have when it has the **same base model**
and a later `publishedAt` (version id when a date is missing). A version for
another base model is never "newer": civitai authors often publish one
version per base model. When several qualify, the latest one wins.

- Card: when the version on screen is in the library and a newer one
  exists, a glowing `⬆ NEWER: v2.0` chip shows; a click points the card at
  it. The version dropdown marks each row `✓ have` and `newest`.
- Listing: per base model, see "listing cards".

## Dock and free mode (card and tag bar)

Each overlay is in one of two modes, saved per overlay:

- **dock** (default, for everyone: saved spots from before are dropped once):
  inserted into civitai's page at its dock spot. If the
  page has no such spot (mobile, another layout, civitai changed its
  markup), it floats instead.
- **free**: floating over the page where you dropped it, else its default
  corner.

Controls, in the overlay's header:
- **⠿ grip / header**: drag to move. Dragging a docked overlay undocks it
  (free mode, at the drop spot). The spot stays on screen when the window
  shrinks.
- **⇱** (shown while docked): undock to free mode.
- **–** fold to a pill: only while floating (a docked strip has no fold).
- **⇲** (shown while floating): try docking again. When the page has no
  dock spot, a short "nothing to dock into on this page" note shows for a
  few seconds.

## Ads

Civitai's ads are removed, visibly: each ad container gets a red glowing
ring with a "✕ ad removed" label, fades and shrinks out over ~1.4 s, then is
hidden. An ad container is the bottom ad bar (`[data-adhesive-ad]`), or the
nearest wrapper of a `visit advertiser` link: the right rail on model pages,
or the ad box in a grid. A container civitai re-renders is caught again on
the next pass. No setting: always on.

## Look: impossible to miss

Civitai is visually loud, so everything the extension adds stands out, kept
compact (tight padding, 1.25 line height, a thin 2px frame, a soft halo that
pulses between 20% and 70%). Only the frames of the card and tag bar and
the listing chips glow: buttons inside a frame keep their gradient but no
halo. The card's label is a small "LM" badge:
- actionable things (⬇ Install, Download, the card frame, the tag bar): a
  red → orange → yellow gradient, white bold text, and a halo that pulses
  slowly;
- "in library" things (✓ LM badges, the card status): a green → cyan
  gradient with the same halo, so "have it" and "get it" never look alike.

The pulse is an `opacity` animation on a `::after` halo layer, which the
compositor runs without layout or paint (no box-shadow animation). It stops
under `prefers-reduced-motion`.

## Root selects

Values are real root paths; labels are the shortest unique tail of the path
(`loras`, or `extra/loras` when two roots end in `loras`), full path on
hover. No `…/` prefixes anywhere.

## Row height

Both docked strips (card and tag bar) have the same height: a 40px frame
with every control 26px high.

## Subfolder combobox (card and tag bar)

One component for every subfolder field, styled as a select with a ▾.
Opening it (click, focus, ▾) lists every folder LoRA Manager knows, the
current value highlighted, whatever the field holds. Typing then filters
LoRA Manager's existing subfolders (substring, case insensitive, deeper folders indented);
↑ ↓ move, Enter picks, Esc closes, a click picks. The first row is "(root)".
Free text is always allowed: when the typed value matches no existing
folder, the first row reads `＋ new folder: foo/bar/baz` and the field shows
a small "new" tag. Any depth works: LoRA Manager creates every missing level
when the download starts (`os.makedirs`), and rejects a path that escapes
the root (`../x`) with an error shown on the card.

## Listing cards (every civitai page)

Every model card (a link to `/models/<id>` that holds an image or video:
home, search, browse, tag pages, creator pages, suggestions) gets a column of
chips on its left edge, 44px down (below civitai's own badge row), **one
chip per base model** the model has a version for (Krea 2, Anima, Pony, …),
each about the **latest version of that base** (latest `publishedAt`):

| state of that base | chip |
|---|---|
| a version of it in the library, none later | green `✓ Krea 2` |
| in the library, a later version of it out | glowing `⬆ NEWER Krea 2` (click installs the later one) |
| not in the library | glowing `⬇ Anima [loras] (anima/styles)`: root label and subfolder as two distinct tags |
| installing | `⬇ Anima 42%`, or the stage text |
| failed | red `✕ Anima failed`, reason in the tooltip, click to retry |

More than 4 bases: the first 4 in civitai's order, then `+N` (the tooltip
lists every base). Until civitai's data for that model is in, a single chip
stands in: `✓ LM` / `✓ LM ×N` when LM has it, plain `⬇ Install` (civitai's
default version) when not.

**Target folder**: the tag rules (below), with `{base}` resolved per chip,
else the last folder used for that model type; the root label is the root's
short name. On a tag page the chips follow the tag bar's **unsaved draft**
live: edit root or subfolder there and every chip retargets as you type;
clicking installs exactly what the chip shows. Saved rules, the last used
folder and the draft all re-render the chips at once when they change.

Civitai data for every model on screen comes from `/api/v1/models?ids=…`,
100 per call. LoRA Manager presence comes from one batched call per ~100 new
ids. LM unreachable → no chips, retried every 30 s. The chips swallow the
click, so civitai's card never navigates.

Hovering a chip shows a styled tooltip at once: each local version as
`v1.0 · Krea 2` with where its files are (`loras › krea2/styles / file`,
fetched on first hover then cached), then one line per base: up to date,
newer version out, or not installed with its target.

## Tag rules (tag → folder)

A rule is `tag → root + subfolder`. Tags are Civitai's, lowercased. A rule
only sets the **default** folder (the card's fields on a model page, and
listing ⬇ Install); editing the card's fields changes one download, never
the rule.

**`{base}`** in a rule's subfolder is replaced by the version's base model,
made folder safe: lowercase, letters and digits only (`Krea 2` → `krea2`,
`Flux.1 D` → `flux1d`, `Illustrious` → `illustrious`), `other` when civitai
gives none. So `style → loras / {base}/styles` sends each LoRA to
`krea2/styles`, `anima/styles`, … The tag bar has a `{base}` button that
inserts it, and says what it does.

- **Where the folder comes from**, for the card and for ⬇ Install: on a tag
  page (`/models?tag=concept`, `/tag/concept`) that page's tag rule wins;
  otherwise the first rule, in list order, matching one of the model's tags;
  otherwise the last folder used for that model type. A rule's root only
  applies when it is a root of the model's type (a LoRA root never applies
  to a checkpoint); the subfolder always does.
- **Tag bar**: on a tag page, a glowing bar reads
  `⠿ Tag concept → [root] / [subfolder] [Save rule]`, or shows the saved
  rule with Delete. Roots offered are every root LoRA Manager
  knows, grouped LoRA / Checkpoint / Embedding, preselected on the saved
  rule's root, else the last LoRA root used. It folds to a pill. Placement: see "Dock and free mode". Its dock
  is its own strip inserted right under civitai's header (`#main header`,
  in the page flow, so it pushes the page down and covers nothing).
  Floating default: bottom left.
- The card shows `Folder from rule: concept` under the folder picker when a
  rule chose it. Editing the folder there changes this download only (and
  the last used folder), never the rule.
- **Popup**: a Rules list, each row with ↑ (move up) and ×.

## The popup

- LoRA Manager URL, default `http://127.0.0.1:8188`, with a Test button that
  shows the LM version or the error.
- Marked list: model name, version, file variant when one was picked, target
  folder, remove button, and
  **Download all** (hands every item to LoRA Manager at once. The server
  runs 5 at a time and queues the rest. Each row shows its progress, and a
  row leaves the list once its version is in the library).

## Restart ComfyUI (card ⚙ popover and popup)

A **Restart ComfyUI** button, with an inline "Really restart?" confirm (it
kills a running generation). Needs the ComfyUI-Manager custom node. Then a
live line:

| phase | shown |
|---|---|
| sending | "Asking ComfyUI to restart…" |
| going down | "Waiting for ComfyUI to stop… Ns" |
| coming back | "Restarting… Ns" |
| back | green "Back in Ns, LoRA Manager <version>". The card re-checks |
| failed | red reason: no ComfyUI-Manager, blocked by its security_level, never went down within 30 s, or not back within 5 min |

## Failure is loud

Every failed call surfaces its error text on the card or popup row. Nothing
fails silently.
