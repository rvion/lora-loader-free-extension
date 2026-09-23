# Spec: what the user sees

## The card (civitai model pages)

Appears bottom right on `https://civitai.com/models/<id>` and
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

## Listing badges (every civitai page)

Every model card on Civitai (a link to `/models/<id>` that holds an image or
video: home, search, browse, creator pages, suggestions) gets a small green
badge at its top left when that model is in the library: `✓ LM`, or
`✓ LM ×2` when several of its versions are. Models not in the library get no
badge. New cards (infinite scroll, SPA navigation) are badged as they
appear, with one batched call per ~100 new ids. A finished download or a
ComfyUI restart re-checks. LM unreachable → no badges, no error spam (the
card already reports it).

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
