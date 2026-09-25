import { configure, reaction } from "mobx";
import { createRoot } from "react-dom/client";

import { ErrorPanel } from "src/content/ErrorPanel.tsx";
import { reportError } from "src/content/ErrorSvc.ts";
import { RulesStrip } from "src/content/RulesUi.tsx";
import { TargetEditorHost } from "src/content/TargetEditor.tsx";
import { CardSt } from "src/content/CardSt.ts";
import { createHost, placeHost, TAG_HOST_ID, UNDER_HEADER_DOCK } from "src/content/dock.ts";

configure({ enforceActions: "always" });

// civitai is a next.js spa: history changes never reach an isolated content
// script, so the url is sampled instead
const URL_POLL_MS = 500;
const ERRORS_HOST_ID = "lmf-errors-host";
/** a dom event, so it crosses from a fresh copy of the extension to the one it replaces */
const TAKEOVER_EVENT = "lmf:takeover";

/** mounts everything; the returned function takes it all down again */
function mount(): () => void {
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
  let orphanSeen = false;
  const tick = () => {
    // the extension was reloaded and nothing replaced this copy: every call would fail from now on
    if (chrome.runtime?.id == null && !orphanSeen) {
      orphanSeen = true;
      reportError("extension", new Error("Extension context invalidated."));
    }
    st.onUrl(location.href);
    placeBar();
  };
  tick();
  const interval = setInterval(tick, URL_POLL_MS);
  // a mode change or the first drag move must re-place at once, not on the next tick
  const stopPlace = reaction(() => `${tp.mode}|${tp.pos == null}`, placeBar);

  const barRoot = createRoot(bar.mountPoint);
  barRoot.render(
    <>
      <RulesStrip root={st} />
      <TargetEditorHost st={st} />
    </>,
  );

  const errs = createHost(ERRORS_HOST_ID);
  document.documentElement.append(errs.host);
  const errRoot = createRoot(errs.mountPoint);
  errRoot.render(<ErrorPanel st={st.errors} />);

  return () => {
    clearInterval(interval);
    stopPlace();
    barRoot.unmount();
    errRoot.unmount();
    bar.host.remove();
    errs.host.remove();
    st.dispose();
  };
}

// an older copy may still run in this tab (the extension was reloaded under it): it leaves first
document.dispatchEvent(new CustomEvent(TAKEOVER_EVENT));
for (const id of [TAG_HOST_ID, ERRORS_HOST_ID]) document.getElementById(id)?.remove();
const unmount = mount();
document.addEventListener(TAKEOVER_EVENT, unmount, { once: true });
