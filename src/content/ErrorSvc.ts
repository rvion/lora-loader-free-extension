import { makeAutoObservable } from "mobx";

export const RELOAD_MESSAGE = "The extension was reloaded: reload this page";

export type ErrorRow = {
  key: string;
  where: string;
  message: string;
  stack: string | null;
  count: number;
  lastAt: number;
  /** the extension context is dead: only a page reload helps */
  reload: boolean;
};

export type ErrorMeta = { version: string; url: () => string; now?: () => number };

/** every failure of the page part, one row per (where, message), copyable (agent/spec.md "errors") */
export class ErrorSvc {
  rows: ErrorRow[] = [];
  isOpen = false;
  /** the row whose copy button just worked, for its "Copied" feedback */
  copied: string | null = null;
  private dismissed = new Set<string>();

  constructor(private meta: ErrorMeta) {
    makeAutoObservable<ErrorSvc, "meta" | "dismissed">(this, { meta: false, dismissed: false });
  }

  report(where: string, e: unknown): void {
    const raw = e instanceof Error ? e.message : String(e);
    const reload = /extension context invalidated/i.test(raw);
    const message = reload ? RELOAD_MESSAGE : raw;
    const key = `${where}\n${message}`;
    const now = this.now();
    const row = this.rows.find((r) => r.key === key);
    if (row != null) {
      row.count++;
      row.lastAt = now;
    } else {
      const stack = e instanceof Error && e.stack != null && e.stack !== "" ? e.stack : null;
      this.rows.push({ key, where, message, stack, count: 1, lastAt: now, reload });
    }
    if (!this.dismissed.has(key)) this.isOpen = true;
  }

  close(): void {
    for (const r of this.rows) this.dismissed.add(r.key);
    this.isOpen = false;
  }

  setCopied(key: string | null): void {
    this.copied = key;
  }

  get needsReload(): boolean {
    return this.rows.some((r) => r.reload);
  }

  copyText(rows: ErrorRow[]): string {
    const head = [`Civitai to LoRA Manager ${this.meta.version} errors`, `page: ${this.meta.url()}`, ""];
    const body = rows.flatMap((r) => {
      const count = r.count > 1 ? ` (×${r.count})` : "";
      const line = `[${new Date(r.lastAt).toISOString()}] ${r.where}${count}: ${r.message}`;
      return r.stack != null ? [line, r.stack] : [line];
    });
    return [...head, ...body].join("\n");
  }

  private now(): number {
    return this.meta.now?.() ?? Date.now();
  }
}

let sink: ErrorSvc | null = null;

/** the one place a page failure goes: the panel, and the console for devtools */
export function reportError(where: string, e: unknown): void {
  console.warn(`[lm-free] ${where}:`, e instanceof Error ? e.message : e);
  sink?.report(where, e);
}

export function setErrorSink(svc: ErrorSvc | null): void {
  sink = svc;
}
