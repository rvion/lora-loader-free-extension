# Changelog

Newest first. Each entry narrates WHAT changed and WHY, for the next
session that arrives with no context.

## 2026-09-25

- Chips took ~50 s to show when the LoRA Manager box was off on the
  network: its TCP connect hangs rather than refusing, and the listing
  pass fetched civitai's data only after LM answered. Every LM GET now
  gives up after 5 s (LmClient readTimeoutMs), and the pass runs the LM
  and civitai fetches in parallel, rendering as each lands.

## 2026-09-24

- Focus now applies to the model page's image chips too (and to mark
  chips); what it hid is counted in a last grey "+N unfocused" chip, on
  tiles and the image alike (withTail).

- Model page chips moved onto the first showcase image (renderHero), like a
  tile; the model page card and its host are deleted, the bar is the one
  host and is identical everywhere (⚙ moved into it). Gate note: shipkit ci
  is blocked by an uncommitted shipkit check (SK023, see
  .shipkit/reflections/20260924-sk023-blocks-every-gate.md); typecheck,
  lint and tests ran through the repo scripts instead.

- Chip layout: the button first and named after the base model (Get Anima,
  Update Krea 2, Retry, Mark / Unmark), then the target as one path
  `loras / anima/styles` (same size, root orange, subfolder blue), each half
  clickable; the editor focuses the half that was clicked (EditRequest.part).

- Chips: 26px like the Rules and Focus buttons, one real [Get] / [Update] /
  [Retry] / [Mark] button as the only thing that acts, no blinking dot (it
  read as recording). The tooltip holds a live getter instead of a snapshot
  and re-renders after each listing pass and when paths arrive: it stayed
  on "locating…" until re-hovered.

- The model page row is now the tile chips (one engine: chipsFor, rendered
  by chipEl on tiles and ChipView in the row); the selects, Download/Mark
  buttons, version chip and where line are gone. Clicking a chip's
  [root] (subfolder) opens the TargetEditor (EditSvc: manual target and file
  per version). LM down turns the row's chips into Mark chips. The bar is
  left aligned so it stays put between pages.

- Civitai category rules (character … action, `{base}/<category>`) seeded
  once at the end of the list (flag categoriesSeeded), and a + Categories
  button re-adds missing ones without duplicates.

- Rules became multi condition (rules.ts: tags, name/tag has, base, type;
  AND across fields, OR inside), edited in a popover opened from a bar that
  is on every page (RulesSvc, RulesUi) and from the model page card; tag
  rules migrated once (rules2). Page context pre fills the draft (tag page,
  search query, url filters); the draft previews live on chips and on the
  card. No match now falls back to the last root with no subfolder: the
  last subfolder (krea2/styles) was landing Illustrious models in a Krea
  folder. Focus (FocusSvc) filters which models get install chips. Chips
  are glass with a pulsing dot so the illustration stays visible.

- Listing chips are one per base model (baseGroups, hasNewer): a single
  "✓ LM" on a Krea 2 / Anima / Illustrious model hid which one you have.
  Install chips carry their target ([root] (sub)), resolved synchronously by
  FolderCtx (rules, roots, last folder in memory) with `{base}` per chip and
  the tag bar's unsaved draft (withDraft) previewed live. Civitai data is now
  fetched for every model on screen, not only owned ones.

- Newer versions (newerVersion: same base model, later publishedAt, checked
  against civitai's real data where versions are one per base model), card
  NEWER chip and dropdown marks, listing ⬆ NEWER VERSION chip fed by
  civitai's models?ids= batch, rich hover tooltip with local paths. Root
  labels are the shortest unique tail (rootLabels, shortRoot deleted), the
  tag bar lists every root by type. Both docked strips share one height.

- ⚙ settings (address + restart) moved from an inline panel to a popover
  under the tools: inline it broke the docked row. Auto opens when LM is
  unreachable, `dismissed` keeps it closed until the address is saved.

- Docked row reworked from the owner's screenshot: no title (the page shows
  it), version chip (hover details, click to switch version in the card
  only, pickVersion), tools moved last, subfolder combobox styled as a select
  that lists every folder on open and filters only once you type.

- Subfolder combobox (SubfolderBox, folderOptions) on the card and the tag
  bar, free text with a "new folder" row. In library now shows where:
  `loras › krea2/styles` + file name + Copy (downloadedFiles from
  check-model-exists, whereInLibrary). Toned down look, "LM" badge, no fold
  when docked, placement keys bumped so everyone starts docked.

- AdSvc removes ads with a visible red ring and fade. The card docks under
  the header as a one row strip: the right rail vanished below civitai's
  desktop breakpoint and took the docked card with it. placeHost keeps any
  run of our hosts after the anchor in place, so two strips cannot swap.

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
