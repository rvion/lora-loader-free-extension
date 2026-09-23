# LoRA Manager and Civitai API surface used

Source of truth: `~/dev/ComfyUI-Lora-Manager` (`py/routes/*_route_registrar.py`,
handlers in `py/routes/handlers/`). Base URL is the ComfyUI (or standalone)
server, default `http://127.0.0.1:8188`.

| call | used for | answer |
|---|---|---|
| `GET /api/lm/version-info` | popup Test | `{ success, version, … }` |
| `GET /api/lm/check-model-exists?modelId=&modelVersionId=` | card status | `{ success, exists, modelType }` |
| `GET /api/lm/<prefix>/roots` | root select | `{ success, roots: string[] }` |
| `GET /api/lm/<prefix>/folders` | subfolder suggestions | `{ folders: string[] }` (relative, `""` is the root) |
| `POST /api/lm/download-model` | download | body `{ model_id, model_version_id, model_root, relative_path, download_id }`, resolves at the END of the download |
| `GET /api/lm/download-progress/<id>` | progress | `{ success, progress, status?, stage?, message? }`, 404 when unknown |

`<prefix>` is `loras`, `checkpoints` or `embeddings`.

## ComfyUI-Manager restart (not LoRA Manager)

Core ComfyUI has no restart route. ComfyUI-Manager (`glob/manager_server.py`)
has `POST /manager/reboot` (current) and `GET /manager/reboot` (old
versions); ComfyUI also serves both under `/api`. It answers 403 unless its
`security_level` is `normal`, `normal-` or `weak`. The process dies while
answering, so a network error on that request means "sent". The live check
pings `/api/lm/version-info` (3 s timeout): down first, then up again.

## Gotchas

- `/api/lm/downloads/queue/add` only records a row: nothing on the server
  consumes that queue. Marked items are driven by the extension instead.
- `download-model-get` exists but takes no target folder, so it is not used.
- A failed download reports `status: "failed"` with `message` in progress.

## Civitai (public, no key, fetched from the content script, same origin)

`GET /api/v1/models/<id>` → `{ name, type, modelVersions: [{ id, name }] }`.
Types mapped: `LORA`, `LoCon`, `DoRA` → `loras`; `Checkpoint` →
`checkpoints`; `TextualInversion` → `embeddings`. Anything else is
"unsupported".
