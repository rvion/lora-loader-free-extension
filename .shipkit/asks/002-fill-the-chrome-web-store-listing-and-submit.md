---
status: open
pinged: 2026-10-27
kind: action
created: 2026-10-27
blocks: the Chrome Web Store listing
thread: ask:002-fill-the-chrome-web-store-listing-and-submit
---

# fill the Chrome Web Store listing, then submit it for review

**Why**: the dashboard is a browser form behind the account owner's login, and the submit is his call

Everything to paste and upload is on ONE page: the hub's stores desk, **Chrome Web Store** (`sk urls` prints the hub; the page is `#page:stores:chrome-web-store`). Left: where the listing stands. Middle: one card per dashboard field, in the dashboard's order, each with **Copy**. Right: the icon, the screenshots, the tiles and the zip, each with **📂** (reveal in Finder, then drag onto the dashboard's drop zone). The source of the page: `.shipkit/chrome-web-store/listing.md` (local, gitignored).

## 1. Take the screenshots ✅

Five, 1280x800, made by `bun run release:shots` on the real civitai.com with this build.

## 2. Upload the package ✅

The draft item exists (`lndbjdcfheikiaohmfdhninonebdjegl`).

## 3. Fill the four tabs from the desk

Open **[Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole)**, the item. Go down the desk's cards in order: **Store listing**, **Privacy**, **Distribution**, **Test instructions**. **Save draft** after each tab.

## 4. Set and verify the contact email

**Settings** page (left menu): enter the publisher's contact email, then click the link of the verification email. Publishing is refused until both are done. **Why can't I submit?** (top right) lists anything still missing.

## 5. Submit for review

Click **Submit for review**. Review takes a few days; the dashboard emails the result.

## 6. Tell the agent "done" with the store URL

The agent adds the store link to the README, the GitHub release and `storeUrl` in `listing.md`.

**Answer**: _(store URL)_

**Done when**: the listing is published and its URL is in the README
