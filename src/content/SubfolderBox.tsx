import { useState } from "react";

import { folderOptions } from "src/shared/paths.ts";

/** subfolder combobox: filters existing folders, free text always allowed (agent/spec.md "subfolder combobox").
 *  open and highlight are view only state, so they stay in react */
export function SubfolderBox(p: {
  value: string;
  folders: string[];
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rows = folderOptions(p.folders, p.value);
  const isNew = p.value.trim() !== "" && rows[0]?.isNew === true;
  const pick = (v: string) => {
    p.onChange(v);
    setOpen(false);
  };
  return (
    <span className="combo">
      <input
        value={p.value}
        placeholder="(root)"
        spellCheck={false}
        onFocus={() => {
          setOpen(true);
          setHi(0);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          p.onChange(e.currentTarget.value);
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            setOpen(true);
            setHi((h) => Math.min(h + 1, rows.length - 1));
            e.preventDefault();
          } else if (e.key === "ArrowUp") {
            setHi((h) => Math.max(h - 1, 0));
            e.preventDefault();
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter") {
            const row = open ? rows[hi] : undefined;
            if (row != null) pick(row.value);
            else p.onEnter?.();
            e.preventDefault();
          }
        }}
      />
      {isNew && <span className="newtag">new</span>}
      {open && rows.length > 0 && (
        <ul className="combo-list" role="listbox">
          {rows.map((r, i) => (
            <li
              key={`${r.isNew ? "+" : ""}${r.value}`}
              role="option"
              aria-selected={i === hi}
              className={i === hi ? "hi" : undefined}
              style={{ paddingLeft: 8 + r.depth * 12 }}
              // mousedown, not click: the input blur would close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r.value);
              }}
              onMouseEnter={() => setHi(i)}
            >
              {r.isNew ? (
                <span className="create">＋ new folder: {r.value}</span>
              ) : r.value === "" ? (
                <span className="muted">(root)</span>
              ) : (
                r.value
              )}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
