import { configure } from "mobx";
import { createRoot } from "react-dom/client";

import { Card, TagBar } from "src/content/Card.tsx";
import { CARD_CSS } from "src/content/cardCss.ts";
import { CardSt } from "src/content/CardSt.ts";
import { createTagHost, placeTagBar } from "src/content/tagDock.ts";

configure({ enforceActions: "always" });

// civitai is a next.js spa: history changes never reach an isolated content
// script, so the url is sampled instead
const URL_POLL_MS = 500;

function mount(): void {
  const host = document.createElement("div");
  host.id = "lora-manager-free-card";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CARD_CSS;
  const root = document.createElement("div");
  shadow.append(style, root);

  const st = new CardSt();
  Object.assign(window, { lmFree: st });
  const tag = createTagHost();
  const tick = () => {
    st.onUrl(location.href);
    placeTagBar(tag.host, st.tag.pageTag != null);
  };
  tick();
  setInterval(tick, URL_POLL_MS);
  createRoot(tag.mountPoint).render(<TagBar st={st} />);
  createRoot(root).render(
    <div className="wrap">
      <Card st={st} />
    </div>,
  );
}

mount();
