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

## Focus (which models get install chips)

Civitai shows everything; focus narrows the red `⬇ Install` chips to the
models you care about. Focus is a filter with the same fields as a rule's
conditions (base model, type, tags, name/tag has; filled fields AND, values
OR), plus an on/off switch, saved.

- **Focus ▾** opens a popover: the on/off switch, then per field the values
  as toggles: quick picks from this page's cards (base models, tags, most
  frequent first) plus the values already in the focus, and a text box to
  add one. The button reads `Focus: off`, or `Focus: Illustrious, LoRA`.
- While focus is on and has at least one value, a listing card's `⬇`
  install chip only shows for base models (versions) that match it. `✓` and
  `⬆ NEWER` chips of models you have always show. The tooltip still lists
  every base.
- The model page card is not filtered: you opened that model on purpose.

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

Chips are **glass**: a see through dark body with thin white text so the
illustration stays visible, the state in a small dot at the start
(pulsing red: install or newer; green: have; orange: installing; solid red:
failed). Hovering a clickable chip makes it opaque.

Hovering a chip shows a styled tooltip at once: each local version as
`v1.0 · Krea 2` with where its files are (`loras › krea2/styles / file`,
fetched on first hover then cached), then one line per base: up to date,
newer version out, or not installed with its target.

## Rules (conditions → folder)

A rule is **conditions → root + subfolder**. It only sets the **default**
folder (the card's fields on a model page, and listing install chips);
editing the card's fields changes one download, never the rule.

**Conditions**, every filled field must match (AND), any value inside a
field is enough (OR); a rule with no condition cannot be saved:

| field | matches when |
|---|---|
| tags | the model has one of these civitai tags |
| name or tag contains | one of these texts is in the model name or in one of its tags (case insensitive) |
| base model | the version's base model is one of these (`Krea 2`, `Anima`, …) |
| type | the model type is one of LoRA / Checkpoint / Embedding |

**Order**: the first matching rule wins. While the rules popover is open,
its draft (saved or not) is tried first, so the page previews it.

**`{base}`** in the subfolder is replaced by the version's base model, made
folder safe: lowercase, letters and digits only (`Krea 2` → `krea2`,
`Flux.1 D` → `flux1d`), `other` when civitai gives none. The root applies
only when it is a root of the model's type (a LoRA root never applies to a
checkpoint); the subfolder always does. **No rule matches** → the last root
used for that type with **no subfolder** (never the last subfolder: it was
built for another model, e.g. `krea2/styles` for an Illustrious model), and
the card says "no rule matches this model".

Rules feed two places: listing install chips, and the default folder of
the card on a model page. The same **rules popover** opens from both: the
rules strip on listing pages, and a **Rules** tool on the model page card.
On a model page the editor starts from that model (its version's base
model; a saved rule the model already matches opens instead), and while it
is open the card's folder fields preview the draft live.

**The bar** is on **every civitai page**, docked as its own strip under
civitai's header (see "dock and free mode"). It always starts with
**[Rules ▾] [Focus ▾]**. On a model page the card's row is the bar (it starts
with the same two buttons, then the card's own content); everywhere else
the bar holds:

```
[LM] [Rules (5) ▾] [Focus: Illustrious, Krea 2 ▾]  here: tag style → loras / {base}/styles   ⇱
```

The "here" line is the saved rule this page's context matches, else "no
rule for this page yet".

**Rules popover** (opened by the button, closed by it, ✕, Esc or a click
outside; the strip's layout never changes):

```
Rules                                            [+ New]  ✕
 1  tag style · base Krea 2  → loras / {base}/styles   ✎ ↑ ✕
 2  has monster              → loras / {base}/monsters ✎ ↑ ✕
─────────────────────────────────────────────────────────────
New rule from this page                  (or: Editing rule 2)
 IF tag [style ✕]  base [Krea 2 ✕]  [+ condition]
 → [loras ▾] / [{base}/styles ▾] {base}
 matches 14 of 40 cards here                      [Save rule]
```

- **Draft from the page** when it opens: a tag page (`/models?tag=style`,
  `/tag/style`) → tag `style`; a search (`/search/models?query=monster`) →
  name or tag contains `monster` (the whole query as one text); base model
  or tag filters in the url are taken too. Default target: the last LoRA
  root and `{base}/<tag or query>`. When a saved rule has exactly these
  conditions, the editor opens on that rule instead. A page with no context
  opens on a blank new rule.
- **Conditions** show as removable chips. `+ condition` opens a small menu:
  pick the field, type a value (Enter adds it), or click a quick pick from
  the values seen on this page's cards (their tags and base models, most
  frequent first).
- **matches N of M cards here** counts the draft against the model cards on
  screen.
- **Save rule** / **Update rule**; ✎ loads a rule into the editor, **+ New**
  starts a blank one.
- While the popover is open every listing chip previews the draft; closing
  it without saving drops the draft.

Existing tag rules are migrated once into rules with a single tag condition.

**Civitai categories** are seeded once, at the end of the list (lowest
priority, so specific rules win), in civitai's order: character, style,
concept, clothing, base model, background, poses, tool, vehicle, assets,
buildings, objects, animal, action. Each is `tag <category> → last used root
/ {base}/<category>` (spaces become dashes: `{base}/base-model`). The
popover's **+ Categories** button adds back any category missing from the
list; it never duplicates one (same conditions = same rule).

## The popup

- LoRA Manager URL, default `http://127.0.0.1:8188`, with a Test button that
  shows the LM version or the error.
- Rules: the same list as the bar's popover, one line each, ↑ and ✕.
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
