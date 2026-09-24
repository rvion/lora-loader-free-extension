# Changelog

Newest first. Each entry narrates WHAT changed and WHY, for the next
session that arrives with no context.

## 2026-09-24

- Dock and free mode for both overlays (PlacementSvc, Movable, generic
  placeHost with append or insert after). The tag bar docks as its own strip
  after `#main header`, checked against civitai's served html: header and
  content are flex column siblings and the content scrolls in its own
  `.scroll-area`. The bottom ad bar dock is gone (worse spot than the top).

- Card docks into civitai's right rail on desktop model pages (ad hidden
  while docked), draggable by its header with the spot saved (`cardPos`),
  ↺ resets. tagDock.ts became the generic dock.ts. Drag listens on window
  because re-parenting out of the rail releases pointer capture.

- Tag bar moved off the top (it covered civitai's filters) into civitai's
  bottom ad slot, own shadow host placed by tagDock.ts, ad hidden by a
  `:has` css rule only while docked. Floating bottom left as fallback.

- ⬇ Install on every listing card (ListingSvc, renamed from BadgeSvc),
  tag → folder rules (folderRules.ts, TagSvc, tag bar, popup list) and the
  loud theme (theme.ts). The owner could not spot the old pills on
  civitai's busy pages, hence the glow.

## 2026-09-23

- v1.0.0 tagged: the version the owner confirmed working live.
- Listing badges (BadgeSvc: MutationObserver, id cache, batches of 100,
  30 s backoff when LM is down) and the file variant picker (file_params
  `{ id }`, Civitai weight file types mirrored from LM's constants).

- Restart ComfyUI button (card ⚙ panel and popup) through ComfyUI-Manager's
  reboot route, newest route first. RestartSt then requires ComfyUI to go
  DOWN before it accepts UP, so a restart that never happened reads as a
  failure instead of an instant success.

- Server address editable from the card (⚙, and shown by itself when LM is
  unreachable) as well as the popup and the Options page. Saving normalizes
  host, ip:port or url, and every open card re-checks. Fixed "http://" being
  accepted as the host "http".

- v0.1.0: the Civitai card (library status, Download into a picked root and
  subfolder, Mark), the popup (LM URL + Test, marked list, Download all), the
  background LM client with the Origin strip rule. Built from LoRA Manager's
  open source API only (agent/lora-manager-api.md). Chrome only, by choice.

- Repo scaffolded: package.json, tsconfig, vscode tasks, agent/ wiki,
  shipkit wiring, first commit.
