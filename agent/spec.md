# Spec: what the user sees

## The model page

The bar is the same as on every other page (see "rules strip"). The model's
chips sit **on its first showcase image**, top left, exactly like a tile's
chips: one per base model, filtered by focus like a tile, same buttons, same
path, same editor, same tooltip, and every base (no `+N` overflow).
The showcase image is the first `image.civitai.com` image or video in the
page that is at least 200×150 on screen and is neither inside a link to a
model (those are suggestion tiles, which get their own chips) nor inside
the header. Civitai re-rendering its gallery moves the chips to the new
first image.

Until the data is in, the image carries the spinner pill (see "listing
cards"). When LoRA Manager does not answer, those chips turn into
`[Mark Anima] loras / anima/styles`: a click marks that version with its
target for the popup's Download all (`★ marked`, the button then says
Unmark).

## Target editor (tiles and model page)

Clicking the `[root] (subfolder)` part of an install chip opens a small
popover next to it:

```
Anima · v1.0                                  ✕
[loras ▾] / [anima/styles ▾] {base}
File [fp16 · 2.1 GB (default) ▾]           (only when several)
[⬇ Install here]   Reset to rule
```

- Root select (short labels) and the subfolder combobox; every change
  applies at once to that chip as a **manual target** for that version
  (the chip shows it with a `✎`), and is remembered as the last folder used.
- **Install here** runs the chip (or **☆ Mark here** when LoRA Manager is
  down). **Reset to rule** drops the manual target.
- Manual targets live for the tab; rules stay the defaults.

## Newer versions

A version is **newer** than one you have when it has the **same base model**
and a later `publishedAt` (version id when a date is missing). A version for
another base model is never "newer": civitai authors often publish one
version per base model. When several qualify, the latest one wins.

Shown per base model by the chips, on tiles and on the model page row
alike: `⬆ NEWER Krea 2` (see "listing cards").

## Focus (which models get install chips)

Civitai shows everything; focus narrows the red `⬇ Install` chips to the
models you care about. Focus is a filter with the same fields as a rule's
conditions (base model, type, tags, name/tag has; filled fields AND, values
OR), plus an on/off switch, saved.

- **Focus ▾** opens a popover: the on/off switch, then per field the values
  as toggles: quick picks from this page's cards (base models, tags, most
  frequent first) plus the values already in the focus, and a text box to
  add one. The button reads `Focus: off`, or `Focus: Illustrious, LoRA`.
- While focus is on and has at least one value, install chips (tiles and
  the model page's image alike) only show for base models (versions) that
  match it. `✓` and newer chips of models you have always show. What focus
  hid is counted in a last, grey, non clickable chip: `+2 unfocused`. The
  tooltip still lists every base.

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

The bar is one docked strip (40px frame, 26px controls), **left aligned** on
every page so nothing moves between pages.

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
lists every base).

**A card is never bare while data is on its way.** A pill shows as soon as
the card is on screen, on the first pass:

| data | pill |
|---|---|
| LM has not answered yet | grey pill with a small spinner |
| LM unreachable | grey `LM offline`, the error on hover |
| LM answered, civitai not yet | `✓ LM` / `✓ LM ×N` when LM has it, plain `Get` (civitai's default version) when not; the spinner pill under focus, since the base models are not known yet |
| civitai failed | the same as "civitai not yet", retried after 10 s |

The first pass after a quiet page runs at once; only a burst of civitai
re-renders is debounced (300 ms).

**Target folder**: the tag rules (below), with `{base}` resolved per chip,
else the last folder used for that model type; the root label is the root's
short name. On a tag page the chips follow the tag bar's **unsaved draft**
live: edit root or subfolder there and every chip retargets as you type;
clicking installs exactly what the chip shows. Saved rules, the last used
folder and the draft all re-render the chips at once when they change.

Civitai data for every model on screen comes from `/api/v1/models?ids=…`,
100 per call. LoRA Manager presence comes from one batched call per ~100 new
ids. The two run in parallel, and the chips render as each one lands: a
slow LoRA Manager never delays civitai's data. A LoRA Manager read that
gets no answer in 5 s counts as unreachable (a box that is off on the
network otherwise hangs ~50 s before the connection fails). LM unreachable
→ `LM offline` on tiles, mark chips on the model page, retried every 30 s
(the retry runs on its own, no page change needed). The
chips swallow the click, so civitai's card never navigates.

Chips are **glass**: a see through dark body with thin white text so the
illustration stays visible, 26px tall like the Rules and Focus buttons. The
chip starts with its one real button, which names the base model it acts
on: **[Get Anima]** (install), **[Update Krea 2]** (newer version),
**[Retry Anima]** (failed), **[Mark Anima]** / **[Unmark Anima]** (LoRA
Manager down). Then the target reads as one path, `loras / anima/styles`:
root and subfolder at the same size, each its own color, `/` between; a
click on the root opens the target editor on the root select, a click on
the subfolder opens it on the subfolder picker. The rest of the chip does
nothing. Nothing blinks: a static
dot says green = have, orange = downloading, red = failed; install chips
have no dot, their button says it.

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

**The bar** is on **every civitai page**, identical everywhere, docked as
its own strip under civitai's header (see "dock and free mode"):

```
[LM] [Rules (5) ▾] [Focus: Illustrious, Krea 2 ▾]  here: tag style → loras / {base}/styles   ⇱ ⚙
```

The "here" line is the saved rule this page's context matches (on a model
page: the first rule this model matches), else "no rule for this page yet".
⚙ opens the server popover: the LoRA Manager address and Restart ComfyUI;
it closes on ⚙, ✕, Esc or a click outside, opens by itself when LoRA
Manager is unreachable, and once closed stays closed until the address is
saved again.

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
