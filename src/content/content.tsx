import { configure } from "mobx";
import { createRoot } from "react-dom/client";

import { Card, TagBar } from "src/content/Card.tsx";
import { CARD_CSS } from "src/content/cardCss.ts";
import { CardSt } from "src/content/CardSt.ts";

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
  st.onUrl(location.href);
  setInterval(() => st.onUrl(location.href), URL_POLL_MS);
  createRoot(root).render(
    <>
      <TagBar st={st} />
      <div className="wrap">
        <Card st={st} />
      </div>
    </>,
  );
}

mount();
