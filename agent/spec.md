# Spec: what the user sees

## The card (civitai model pages)

Appears bottom right on `https://civitai.com/models/<id>` and
`https://civitai.red/models/<id>`, for the version in `?modelVersionId=`
(else the model's first version). Follows SPA navigation: switching version
or model updates the card without a reload. Collapsible to a small pill.

Header: model name, version name, Civitai type.

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

- **Folder picker**: a root select (from LoRA Manager's roots for that model
  type) and a subfolder field with suggestions from existing subfolders.
  Free text creates a new subfolder. The last choice is remembered per model
  type and pre-filled.
- **Download**: starts the download into the picked root + subfolder.
- **Mark** / **Unmark**: adds or removes this version (with the picked
  folder) from the marked list.

## The popup

- LoRA Manager URL, default `http://127.0.0.1:8188`, with a Test button that
  shows the LM version or the error.
- Marked list: model name, version, target folder, remove button, and
  **Download all** (hands every item to LoRA Manager at once. The server
  runs 5 at a time and queues the rest. Each row shows its progress, and a
  row leaves the list once its version is in the library).

## Failure is loud

Every failed call surfaces its error text on the card or popup row. Nothing
fails silently.
