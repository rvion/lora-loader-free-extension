---
status: open
kind: action
created: 2026-10-27
blocks: the Chrome Web Store listing
---

# take screenshots, then upload and submit the extension to the Chrome Web Store

**Why**: the dashboard upload and the submit need the account owner

Everything to paste and upload sits in `.shipkit/chrome-web-store/` (gitignored, local only): the zip, the promo tile, and `listing.md` with every text field and permission justification. Rebuild them any time with `bun run release:files`.

## 1. Try the new build

Load `dist/` (chrome://extensions → reload the card). If your LoRA Manager is not on this machine, open the popup and click **Allow access to <host>** once. Then check a civitai page: chips appear, and **improve experience** on the bar hides the ads and shows them again.

## 2. Take 1 to 5 screenshots

On civitai.com with the extension working (a model page with chips, a listing with ✓ and ⬇ chips, the Rules popover), take window screenshots and drop them in `.shipkit/chrome-web-store/screenshots/`. Tell the agent: it resizes them to 1280×800 and checks they show nothing private.

## 3. Upload

Open **[Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole)**, click **New item**, upload the zip.

| field | value |
|---|---|
| zip | `.shipkit/chrome-web-store/civitai-to-lora-manager-2.21.8.zip` |

## 4. Fill the three tabs from listing.md

**Store listing**, **Privacy practices**, **Distribution**: every value is in `.shipkit/chrome-web-store/listing.md`, in tab order. Upload the promo tile and the screenshots in Store listing.

## 5. Submit for review

Click **Submit for review**. Review usually takes a few days; the dashboard emails the result.

## 6. Tell the agent "done" with the store URL

The agent adds the store link to the README and the GitHub release.

**Answer**: _(store URL)_

**Done when**: the listing is published and its URL is in the README
