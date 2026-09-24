import { configure, reaction } from "mobx";
import { createRoot } from "react-dom/client";

import { RulesStrip } from "src/content/RulesUi.tsx";
import { TargetEditorHost } from "src/content/TargetEditor.tsx";
import { CardSt } from "src/content/CardSt.ts";
import { createHost, placeHost, TAG_HOST_ID, UNDER_HEADER_DOCK } from "src/content/dock.ts";

configure({ enforceActions: "always" });

// civitai is a next.js spa: history changes never reach an isolated content
// script, so the url is sampled instead
const URL_POLL_MS = 500;

function mount(): void {
  const st = new CardSt();
  Object.assign(window, { lmFree: st });

  const bar = createHost(TAG_HOST_ID);
  const tp = st.rules.placement;
  const placeBar = () =>
    tp.setActual(
      placeHost(bar.host, {
        visible: true,
        dock: UNDER_HEADER_DOCK,
        free: tp.mode === "free",
        hasPos: tp.pos != null,
      }),
    );
  const tick = () => {
    st.onUrl(location.href);
    placeBar();
  };
  tick();
  setInterval(tick, URL_POLL_MS);
  // a mode change or the first drag move must re-place at once, not on the next tick
  reaction(() => `${tp.mode}|${tp.pos == null}`, placeBar);

  createRoot(bar.mountPoint).render(
    <>
      <RulesStrip root={st} />
      <TargetEditorHost st={st} />
    </>,
  );
}

mount();
