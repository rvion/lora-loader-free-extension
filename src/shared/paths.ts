const toSlash = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");

/** the last two segments, so a long root stays readable */
export function shortRoot(root: string): string {
  const parts = toSlash(root)
    .split("/")
    .filter((s) => s !== "");
  return parts.length <= 2 ? root : `…/${parts.slice(-2).join("/")}`;
}

/** splits a file path into the model root holding it (longest match) and the rest */
export function locateInRoots(
  filePath: string,
  roots: string[],
): { root: string | null; rel: string } {
  const file = toSlash(filePath);
  let best: string | null = null;
  for (const r of roots) {
    const root = toSlash(r);
    if (
      file.toLowerCase().startsWith(`${root.toLowerCase()}/`) &&
      (best == null || root.length > toSlash(best).length)
    )
      best = r;
  }
  return best == null
    ? { root: null, rel: file }
    : { root: best, rel: file.slice(toSlash(best).length + 1) };
}

/** { rootName: "loras", dir: "krea2/styles", fileName } for the card's "where" line */
export function whereInLibrary(
  filePath: string,
  roots: string[],
): { rootName: string; dir: string; fileName: string } {
  const at = locateInRoots(filePath, roots);
  const parts = at.rel.split("/");
  const fileName = parts.pop() ?? at.rel;
  const dir = parts.join("/");
  if (at.root == null) return { rootName: dir, dir: "", fileName };
  const rootName =
    toSlash(at.root)
      .split("/")
      .filter((s) => s !== "")
      .pop() ?? at.root;
  return { rootName, dir, fileName };
}

export type FolderOption = { value: string; depth: number; isNew: boolean };

/** combobox rows: "(root)", then a create row when the typed value is new, then matching folders */
export function folderOptions(folders: string[], query: string, limit = 60): FolderOption[] {
  const q = query.trim().toLowerCase();
  const typed = toSlash(query.trim()).replace(/^\/+/, "");
  const exists = folders.some((f) => f.toLowerCase() === typed.toLowerCase());
  const rows: FolderOption[] = [];
  if (q === "") rows.push({ value: "", depth: 0, isNew: false });
  else if (!exists) rows.push({ value: typed, depth: 0, isNew: true });
  const matches = folders
    .filter((f) => q === "" || f.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
  for (const f of matches) rows.push({ value: f, depth: f.split("/").length - 1, isNew: false });
  return rows;
}
