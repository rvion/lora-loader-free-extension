import { installOriginRule } from "src/background/originRule.ts";
import { LmClient } from "src/shared/lmClient.ts";
import type { Kind, Protocol, Reply, Request } from "src/shared/messages.ts";
import { getSettings } from "src/shared/storage.ts";

const FAST_FAILURE_WINDOW_MS = 3000;

/** late POST failures, keyed by download id, handed out by the next progress call */
const lateFailures = new Map<string, string>();

let originRuleFor: string | null = null;

async function client(url?: string): Promise<LmClient> {
  const c = new LmClient(url ?? (await getSettings()).lmUrl);
  if (originRuleFor !== c.baseUrl) {
    await installOriginRule(c.baseUrl);
    originRuleFor = c.baseUrl;
  }
  return c;
}

async function getActive(): Promise<Record<string, string>> {
  const got = await chrome.storage.session.get("active");
  return (got.active as Record<string, string> | undefined) ?? {};
}

async function setActive(versionId: number, downloadId: string | null): Promise<void> {
  const active = await getActive();
  if (downloadId == null) delete active[String(versionId)];
  else active[String(versionId)] = downloadId;
  await chrome.storage.session.set({ active });
}

type Handlers = { [K in Kind]: (req: Request<K>) => Promise<Protocol[K]["res"]> };

const handlers: Handlers = {
  lmVersion: async (req) => (await client(req.url)).version(),
  libraryStatus: async (req) => (await client()).libraryStatus(req.modelId, req.versionId),
  folderChoices: async (req) => (await client()).folderChoices(req.prefix),
  activeDownload: async (req) => (await getActive())[String(req.versionId)] ?? null,
  clearActive: async (req) => {
    await setActive(req.versionId, null);
    return null;
  },
  progress: async (req) => {
    const failure = lateFailures.get(req.downloadId);
    if (failure != null) return { kind: "failed", message: failure };
    return (await client()).progress(req.downloadId);
  },
  startDownload: async (req) => {
    const c = await client();
    const t = req.target;
    const downloadId = crypto.randomUUID();
    await setActive(t.versionId, downloadId);
    const done = c.download({
      downloadId,
      modelId: t.modelId,
      versionId: t.versionId,
      root: t.folder.root,
      sub: t.folder.sub,
    });
    const settled = done.then(
      () => ({ failed: false as const }),
      (e: unknown) => ({
        failed: true as const,
        message: e instanceof Error ? e.message : String(e),
      }),
    );
    const early = await Promise.race([settled, sleep(FAST_FAILURE_WINDOW_MS).then(() => null)]);
    if (early?.failed === true) {
      await setActive(t.versionId, null);
      throw new Error(early.message);
    }
    void settled.then((r) => {
      if (r.failed) lateFailures.set(downloadId, r.message);
    });
    return { downloadId };
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatch(req: Request): Promise<Reply<Kind>> {
  const handler = handlers[req.kind] as (r: Request) => Promise<unknown>;
  try {
    return { ok: true, data: (await handler(req)) as Protocol[Kind]["res"] };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[lm-free] ${req.kind} failed:`, error);
    return { ok: false, error: networkHint(error) };
  }
}

function networkHint(error: string): string {
  return error === "Failed to fetch"
    ? "cannot reach LoRA Manager (is ComfyUI running, and is the URL in the popup right?)"
    : error;
}

chrome.runtime.onMessage.addListener((msg: Request, _sender, sendResponse) => {
  void dispatch(msg).then(sendResponse);
  return true;
});
