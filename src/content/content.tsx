import { configure, reaction } from "mobx";
import { createRoot } from "react-dom/client";

import { CardShell, TagBar } from "src/content/Card.tsx";
import { CardSt } from "src/content/CardSt.ts";
import {
  AD_BAR_SLOT,
  CARD_HOST_ID,
  createHost,
  placeHost,
  RAIL_SLOT,
  TAG_HOST_ID,
} from "src/content/dock.ts";

configure({ enforceActions: "always" });

// civitai is a next.js spa: history changes never reach an isolated content
// script, so the url is sampled instead
const URL_POLL_MS = 500;

function mount(): void {
  const st = new CardSt();
  Object.assign(window, { lmFree: st });

  const card = createHost(CARD_HOST_ID, "card-root");
  const tag = createHost(TAG_HOST_ID, "dock");
  const placeCard = () =>
    placeHost(card.host, {
      visible: st.page.isModelPage,
      slotSelector: RAIL_SLOT,
      custom: st.placement.pos != null,
    });
  const tick = () => {
    st.onUrl(location.href);
    placeCard();
    placeHost(tag.host, {
      visible: st.tag.pageTag != null,
      slotSelector: AD_BAR_SLOT,
      custom: false,
    });
  };
  tick();
  setInterval(tick, URL_POLL_MS);
  // a drag out of the rail must leave it on the first move, not on the next tick
  reaction(() => st.placement.pos == null, placeCard);

  createRoot(card.mountPoint).render(<CardShell st={st} />);
  createRoot(tag.mountPoint).render(<TagBar st={st} />);
}

mount();
