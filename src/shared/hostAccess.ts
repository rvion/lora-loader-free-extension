// chrome's per host grant for the LM address (agent/spec.md "host access").
// 127.0.0.1 and localhost come with the install, any other host is an
// optional permission asked for from an extension page, never a content script

/** the pattern chrome grants: every port of that host */
export function hostPattern(baseUrl: string): string {
  const u = new URL(baseUrl);
  return `${u.protocol}//${u.hostname}/*`;
}

export function noAccessMessage(baseUrl: string): string {
  return `Chrome has not allowed ${new URL(baseUrl).hostname} yet: open the extension popup and allow it`;
}

export function hasHostAccess(baseUrl: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [hostPattern(baseUrl)] });
}

/** must run inside the click that asked for it: call it before any other await */
export function requestHostAccess(baseUrl: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [hostPattern(baseUrl)] });
}
