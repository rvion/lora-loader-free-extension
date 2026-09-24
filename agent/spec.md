# Spec: what the user sees

## The card (civitai model pages)

Placement: see "Dock and free mode" below. Its dock is a full width strip
right under civitai's header (the same spot as the tag bar, which never
shows on a model page), laid out in one wrapping row: title, status, file,
folder, actions. It stays when the window shrinks, mobile included.
Floating default: bottom right, as a vertical card.

Appears on `https://civitai.com/models/<id>` and
`https://civitai.red/models/<id>`, for the version in `?modelVersionId=`
(else the model's first version). Follows SPA navigation: switching version
or model updates the card without a reload. Collapsible to a small pill.

Header: model name, version name, Civitai type. A ⚙ button opens the
server URL field (same setting as the popup: ComfyUI host, IP or full URL,
e.g. `192.168.1.20:8188`). The field also opens by itself whenever LoRA
Manager is unreachable. Saving it, from the card or the popup, re-checks the
card at once.

Status line, one of:

| state | shown |
|---|---|
| checking | "Checking library…" |
| in library | green "In library" + LoRA Manager type (lora, checkpoint, …) |
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
  type) and a subfolder field with suggestions from existing subfolders.
  Free text creates a new subfolder. The last choice is remembered per model
  type and pre-filled.
- **Download**: starts the download into the picked root + subfolder.
- **Mark** / **Unmark**: adds or removes this version (with the picked
  folder) from the marked list.

## Dock and free mode (card and tag bar)

Each overlay is in one of two modes, saved per overlay:

- **dock** (default): inserted into civitai's page at its dock spot. If the
  page has no such spot (mobile, another layout, civitai changed its
  markup), it floats instead.
- **free**: floating over the page where you dropped it, else its default
  corner.

Controls, in the overlay's header:
- **⠿ grip / header**: drag to move. Dragging a docked overlay undocks it
  (free mode, at the drop spot). The spot stays on screen when the window
  shrinks.
- **⇱** (shown while docked): undock to free mode.
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

Civitai is visually loud, so everything the extension adds is louder:
- actionable things (⬇ Install, Download, the card frame, the tag bar): a
  red → orange → yellow gradient, white bold text, and a halo that pulses
  slowly;
- "in library" things (✓ LM badges, the card status): a green → cyan
  gradient with the same halo, so "have it" and "get it" never look alike.

The pulse is an `opacity` animation on a `::after` halo layer, which the
compositor runs without layout or paint (no box-shadow animation). It stops
under `prefers-reduced-motion`.

## Listing cards (every civitai page)

Every model card (a link to `/models/<id>` that holds an image or video:
home, search, browse, tag pages, creator pages, suggestions) gets, on its
left edge 44px down (below the badge row civitai draws along the top of the
card), once LM has answered for it:

| state | shown |
|---|---|
| in library | green `✓ LM`, or `✓ LM ×N` when N versions are |
| not in library | glowing `⬇ Install` button |
| installing | `⬇ 42%`, or the stage text (`queued`, …) |
| failed | red `✕ failed`, the error as tooltip. Click to retry |

⬇ Install downloads the model's latest version (Civitai's first), its
primary file, into the folder the tag rules give (below), else the last
folder used for that model type. The click never opens the model page.
When the file is in the library the button turns into ✓ LM.

New cards (infinite scroll, SPA navigation) get badges as they appear, with
one batched call per ~100 new ids. LM unreachable → no badges, retried every
30 s.

## Tag rules (tag → folder)

A rule is `tag → root + subfolder`. Tags are Civitai's, lowercased.

- **Where the folder comes from**, for the card and for ⬇ Install: on a tag
  page (`/models?tag=concept`, `/tag/concept`) that page's tag rule wins;
  otherwise the first rule, in list order, matching one of the model's tags;
  otherwise the last folder used for that model type. A rule's root only
  applies when it is a root of the model's type (a LoRA root never applies
  to a checkpoint); the subfolder always does.
- **Tag bar**: on a tag page, a glowing bar reads
  `⠿ Tag concept → [root] / [subfolder] [Save rule]`, or shows the saved
  rule with Delete. Roots offered are the LoRA roots, plus "(last used
  root)". It folds to a pill. Placement: see "Dock and free mode". Its dock
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

## Restart ComfyUI (card ⚙ panel and popup)

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
