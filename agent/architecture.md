# Architecture

## Entry points (each bundled by `scripts/build.ts` into `dist/`)

| entry | runs in | owns |
|---|---|---|
| `src/background/background.ts` | service worker | every LoRA Manager call, the Origin rule, the marked list runner |
| `src/content/content.tsx` | civitai.com page | the card, in a shadow root |
| `src/popup/popup.tsx` | action popup | settings, marked list |

`src/shared/` is pure code imported by all three: URL parsing, type mapping,
the LM client, the message protocol, storage keys.

## Why the background owns every LM call

- A content script fetch runs with the page's origin: CORS and Chrome's
  Private Network Access block civitai.com → 127.0.0.1.
- The service worker has host permission on `http://*/*` for the configured
  LM URL, so its fetches skip CORS.
- Recent ComfyUI rejects a loopback request whose `Origin` host differs from
  `Host` (403). A `declarativeNetRequest` session rule removes `Origin` on
  requests that the extension itself sends (`tabIds: [-1]`) to the LM host,
  and only those. It is re-installed whenever the LM URL changes.

## Message flow

Content and popup call `sendRequest(req)` (`src/shared/messages.ts`), a typed
union: `check`, `folders`, `download`, `progress`, `marked:*`, `settings:*`.
The background answers `{ ok: true, data } | { ok: false, error }`.

## Downloads

- The extension picks the `download_id` (uuid) and fires
  `POST /api/lm/download-model`. That request only resolves when the file is
  done, so the background waits 3 s for a fast failure (validation, early
  access) and otherwise answers "started".
- The server keeps running the download whether or not the worker lives.
  The card polls `GET /api/lm/download-progress/<id>` every second and
  re-checks existence once progress hits 100 or the id is gone.
- Active downloads (version id → download id) live in
  `chrome.storage.session`, so a reopened tab resumes the progress bar.
- A late failure of that POST (after the 3 s window) is kept in worker memory
  and returned by the next `progress` call, so it still reaches the UI.
- Download all starts every marked item at once: LoRA Manager's download
  manager holds a semaphore of 5 and queues the rest, so no client side
  runner has to outlive the service worker.

## State (content and popup)

One root per surface, per build/app-state-tree: `CardSt` (content) and
`PopupSt` (popup), services hang off it, components hold no business state.
`Query<T>` in `src/shared/Query.ts` is the one async primitive.

## Listing cards

`ListingSvc` (on `CardSt`, so it runs on every civitai page) owns one
MutationObserver, debounced 300 ms. Each pass: every `a[href*="/models/"]`
holding an `img` or `video` → model id → cached presence + install job →
one overlay element per card, re-rendered only when its text changes (so
its own writes never loop the observer). Unknown ids go out in chunks of
100 (`libraryBatch`). The overlay lives in civitai's DOM, styled by one
`<style id="lmf-page-css">` in `<head>` (keyframes and `::after` need a
stylesheet). Its click handler stops the event and prevents the anchor's
navigation. Install = civitai model fetch → prefix, latest version, primary
file → `suggestFolder` → `startDownload` → `watchDownload`.

## Folder choice

`resolveFolder` (pure, `src/shared/folderRules.ts`) implements the rule
order in agent/spec.md. `suggestFolder` gathers its inputs (roots, rules,
last folder) and is the one entry for the card and ⬇ Install.

## Theme

`src/shared/theme.ts` holds the gradients and the halo css, used by the
shadow root (card, tag bar) and the page stylesheet (listing overlays).

## Storage

| key | area | shape |
|---|---|---|
| `settings` | sync | `{ lmUrl }` |
| `lastFolder:<prefix>` | local | `{ root, sub }` |
| `marked` | local | `MarkedItem[]` |
| `tagRules` | local | `TagRule[]` (order = priority) |
| `active` | session | `Record<versionId, downloadId>` |
