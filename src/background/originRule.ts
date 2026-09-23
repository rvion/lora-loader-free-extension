// recent ComfyUI answers 403 to a loopback request whose Origin host differs
// from Host, and the worker's Origin is chrome-extension://<id>. this strips
// Origin on requests the extension itself sends (tabIds -1) to the LM host only
const RULE_ID = 1;

export async function installOriginRule(lmBaseUrl: string): Promise<void> {
  const host = new URL(lmBaseUrl).host;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header: "origin", operation: "remove" }],
        },
        condition: {
          urlFilter: `|${new URL(lmBaseUrl).protocol}//${host}/`,
          tabIds: [chrome.tabs.TAB_ID_NONE],
        },
      },
    ],
  });
}
