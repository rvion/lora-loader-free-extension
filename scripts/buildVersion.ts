/** every build is a new patch: 2.21.1 → 2.21.2 (agent/architecture.md) */
export function nextBuildVersion(current: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (m == null) throw new Error(`package.json version ${current} is not three numbers`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/** the raw package.json with only its version value replaced, so its layout survives */
export function withVersion(raw: string, version: string): string {
  const out = raw.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  if (out === raw) throw new Error("package.json has no version field to bump");
  return out;
}
