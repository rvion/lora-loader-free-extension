# Architecture

## Entry points (each bundled by `scripts/build.ts` into `dist/`)

| entry | runs in | owns |
|---|---|---|
| `src/background/background.ts` | service worker | every LoRA Manager call, the Origin rule, the marked list runner |
| `src/content/content.tsx` | civitai.com page | the card, in a shadow root |
| `src/popup/popup.tsx` | action popup | settings, marked list |

Every build gets a new version, so chrome://extensions shows which build is
loaded. `bun run build` bumps the patch in package.json (`2.21.1` →
`2.21.2`), writes it back, and puts it in `dist/manifest.json`.
package.json stays the one version source: commit its bump with the work.
`shipkit bump minor` / `major` still moves the rest.

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
- Every download names one Civitai file (`file_params: { id }`): LoRA
  Manager then checks that file alone, so several variants of one version
  can each be downloaded. Jobs, marks and active downloads are keyed by
  `versionId:fileId` (`fileKey`), never by version alone.
- A download is done when LoRA Manager lists that file name for the
  version, or when it forgot the download id and the version exists.
- Active downloads (file key → download id) live in
  `chrome.storage.session`.
- A late failure of that POST (after the 3 s window) is kept in worker memory
  and returned by the next `progress` call, so it still reaches the UI.
- Download all starts every marked item at once: LoRA Manager's download
  manager holds a semaphore of 5 and queues the rest, so no client side
  runner has to outlive the service worker.

## State (content and popup)

One root per surface, per build/app-state-tree: `CardSt` (content) and
`PopupSt` (popup), services hang off it, components hold no business state.
`Query<T>` in `src/shared/Query.ts` is the one async primitive.

## One chip engine

`ListingSvc` builds every chip from the same `chipsFor` data and renders it
as plain dom (`chipEl`): on tiles, and on a model page over its first
showcase image (`showcaseHost`, `renderHero`), for the model it `watch`es
even though that model is not a tile. It bumps an observable `rev` after
each pass (the bar reads `isLmDown` through it) and switches the model
page's chips to mark chips while LoRA Manager is down. `EditSvc` holds
manual targets and file picks (`FilePick[]`, any version of the chip's
base model) per chip version for the tab; the `TargetEditor`
popover edits them.

There is **one** shadow host, the bar (`#lmf-tagbar-host`): Rules, Focus,
the "here" line, tools and the ⚙ server popover, identical on every page;
the target editor renders in it too. The model page card (its own host,
placement and row) is gone.

## Listing cards

`ListingSvc` (on `CardSt`, so it runs on every civitai page) owns one
MutationObserver, debounced 300 ms. Each pass: every `a[href*="/models/"]`
holding an `img` or `video` → model id → cached presence + install job →
one overlay element per card, re-rendered only when its text changes (so
its own writes never loop the observer). Unknown ids go out in chunks of
100 (`libraryBatch`). The overlay lives in civitai's DOM, styled by one
`<style id="lmf-page-css">` in `<head>` (keyframes and `::after` need a
stylesheet). Its click handler stops the event and prevents the anchor's
navigation. Install = civitai model fetch → prefix → the chip's picked
files (default: latest version, primary file) → one `startDownload` +
`watchDownload` per file.

## Placement (card and tag bar)

Each overlay has its own shadow host and a `PlacementSvc`
(`src/content/PlacementSvc.ts`: `mode` dock|free, free `pos`, the `actual`
host mode, the dock miss note). `placeHost` (`src/content/dock.ts`) puts
the host in the page, returns the actual mode, and runs on the 500 ms url
tick and at once on a mode or pos change (a mobx reaction per overlay).
`Movable` (`src/content/Movable.tsx`) is the positioned box plus the drag.

| overlay | dock | floating default |
|---|---|---|
| card (`#lora-manager-free-card`) | inserted after `#main header`, horizontal strip | bottom right |
| tag bar (`#lmf-tagbar-host`) | inserted after `#main header` | bottom left |

Header and content are siblings in a flex column and the content scrolls in
its own `.scroll-area`, so a strip there stays visible at every width. The
card and the tag bar never show on the same page; `placeHost` still treats
any run of our hosts right after the anchor as "in place", so two docked
hosts could never swap forever. The right rail is not a dock: civitai hides
it below its desktop breakpoint, and the card vanished with it.

Keyboard: each host stops keydown, keypress and keyup whose real target
(`composedPath()[0]`) is one of our inputs, selects or textareas. Civitai's
hotkeys ("/" focuses its search) listen on the document and see the shadow
host as the target, so without this they fire while typing in our fields.

Host modes (`data-mode`, styled with `:host([data-mode=…])`): `docked`,
`floating` (default corner), `custom` (at `pos`). Drags listen on window:
undocking re-parents the host, which would release pointer capture.

## Ads

`AdSvc` (on `CardSt`): one debounced MutationObserver. Each pass finds ad
containers (`[data-adhesive-ad]`, else the closest `[class*="__rail"]` or
`.box-content` around `a[aria-label="visit advertiser"]`) not yet marked,
adds `lmf-ad-kill` (red ring, label, opacity and transform keyframes), then
`lmf-ad-gone` (`display: none`) on `animationend` or after 1.6 s. Both
classes live in PAGE_CSS.

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
| `placement2:card`, `placement2:tag` (v1 keys dropped so everyone starts docked) | local | `{ mode: "dock" \| "free", pos: { x, y } \| null }` |
| `active` | session | `Record<fileKey, downloadId>` |
