/** chrome caps each of the four version numbers at 65535 */
const MAX_PART = 65535;

/** `<package.json version>.<build>`: the previous build's number plus one, 1 after a package.json bump */
export function nextBuildVersion(pkg: string, prev: string | null): string {
  const m = prev != null ? /^(\d+\.\d+\.\d+)\.(\d+)$/.exec(prev) : null;
  const build = m?.[1] === pkg ? Number(m[2]) + 1 : 1;
  if (build > MAX_PART)
    throw new Error(
      `build number ${build} passes chrome's limit of ${MAX_PART}: bump package.json`,
    );
  return `${pkg}.${build}`;
}
