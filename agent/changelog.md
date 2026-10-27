# Changelog

Newest first. Each entry narrates WHAT changed and WHY, for the next
session that arrives with no context.

## 2026-10-27

- Public release prep for GitHub and the Chrome Web Store. Renamed to
  "Civitai to LoRA Manager (unofficial)": the old name read as the official
  LoRA Manager extension, which the store treats as impersonation.
- Ad removal is opt in (AdSvc reads `improveExperience` from storage, the
  bar's `improve experience` button flips it, off restores the hidden ads):
  the store's single purpose rule.
- Host access: install time hosts are civitai, 127.0.0.1 and localhost;
  any other LM host is an optional permission granted from an extension
  page (hostAccess.ts). All hosts at install time meant in depth review and
  the scariest install warning. The card cannot ask Chrome, so its ⚙
  popover offers `Allow…`, which opens the options page.
- Icon: `.shipkit/identity/icon.svg`, a vector redraw of the old raster
  icon. The build renders the manifest icons, brand.ts the identity kit.
  `--release` builds without bumping, `release:files` zips for the store.

## 2026-09-28

- File picks on the chip: the chip names what Get downloads with its size
  (`bf16 · 24.5 GB · 1 of 4 ▾`, framed yellow when the version has other
  files), and a click opens the editor's Files list: every version of that
  base model, every weight file, checkboxes, `✓ have`. Get downloads each
  picked file. Cause: Krea 2 Anime v1.4 has bf16 (24.5 GB), int8 and int4;
  Get silently took the primary bf16, and the only picker was a select
  hidden in the target editor. That download froze the box (ComfyUI's
  python at 40.7 GB private).

- Jobs, marks and active downloads are keyed per file (`fileKey`), and a
  download is done only once its own file name is listed: two variants of
  one version are two downloads. The unused activeDownload message is gone.

## 2026-09-25

- Errors panel (ErrorSvc, ErrorPanel): every page failure goes through
  reportError into a bottom right panel, one row per (where, message) with
  a count, a Copy button per row and Copy all (version, page, time, stack).
  Failures used to reach only the console, so they had to be dug out of
  chrome://extensions to be shared.

- "Extension context invalidated" was the cause of the empty cards: a
  reloaded extension leaves each open tab with a dead copy whose every
  call fails. The background now re-injects content.js into open civitai
  tabs on install and update (scripting permission), the new copy sends a
  lmf:takeover DOM event, and the old copy unmounts and removes its bar,
  chips, tooltip and page css (CardSt.dispose, ListingSvc.dispose). A copy
  left dead anyway reports it as "reload this page" with a Reload button.

- Cards are never bare while data is on its way: a spinner pill while LM
  or civitai is answering, a grey `LM offline` pill (error on hover) when
  LM is unreachable, which used to leave the card empty. The first pass
  after a quiet page runs at once (nextPassDelay), instead of a fixed
  300 ms debounce. A failed civitai details call used to leave its models
  empty until the page was reloaded; it now retries after 10 s, and the
  LM backoff retries on its own too.

- Every successful build bumps the patch in package.json and writes it
  into dist/manifest.json (scripts/buildVersion.ts), so chrome://extensions
  shows which build is loaded. Three numbers, never a fourth. The version
  jumped from 1.0.0 to 2.21.1 by hand first.

- Every LM GET gives up after 5 s (LmClient readTimeoutMs): a host that
  is off on the network hangs a TCP connect ~50 s rather than refusing it.
  The listing pass runs the LM and civitai fetches in parallel, rendering
  as each lands. Correction: this was first blamed for the slow chips, but
  that probe hit the wrong port (LM runs on another port and was up). The real
  cause was the dead extension context, see the takeover entry above.

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
