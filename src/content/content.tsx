import { configure, reaction } from "mobx";
import { createRoot } from "react-dom/client";

import { CardShell, TagBar } from "src/content/Card.tsx";
import { CardSt } from "src/content/CardSt.ts";
import {
  CARD_HOST_ID,
  createHost,
  placeHost,
  RAIL_DOCK,
  TAG_HOST_ID,
  UNDER_HEADER_DOCK,
} from "src/content/dock.ts";

configure({ enforceActions: "always" });

// civitai is a next.js spa: history changes never reach an isolated content
// script, so the url is sampled instead
const URL_POLL_MS = 500;

function mount(): void {
  const st = new CardSt();
  Object.assign(window, { lmFree: st });

  const card = createHost(CARD_HOST_ID);
  const tag = createHost(TAG_HOST_ID);
  const placeCard = () =>
    st.placement.setActual(
      placeHost(card.host, {
        visible: st.page.isModelPage,
        dock: RAIL_DOCK,
        free: st.placement.mode === "free",
        hasPos: st.placement.pos != null,
      }),
    );
  const tp = st.tag.placement;
  const placeTag = () =>
    tp.setActual(
      placeHost(tag.host, {
        visible: st.tag.pageTag != null,
        dock: UNDER_HEADER_DOCK,
        free: tp.mode === "free",
        hasPos: tp.pos != null,
      }),
    );
  const tick = () => {
    st.onUrl(location.href);
    placeCard();
    placeTag();
  };
  tick();
  setInterval(tick, URL_POLL_MS);
  // a mode change or the first drag move must re-place at once, not on the next tick
  reaction(() => `${st.placement.mode}|${st.placement.pos == null}`, placeCard);
  reaction(() => `${tp.mode}|${tp.pos == null}`, placeTag);

  createRoot(card.mountPoint).render(<CardShell st={st} />);
  createRoot(tag.mountPoint).render(<TagBar st={st} />);
}

mount();
