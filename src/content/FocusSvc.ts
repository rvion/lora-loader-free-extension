import { makeAutoObservable, toJS } from "mobx";

import type { LmPrefix } from "src/shared/civitai.ts";
import {
  emptyCond,
  isEmptyCond,
  typeName,
  type CondField,
  type RuleCond,
} from "src/shared/rules.ts";
import { getFocus, onFocusChanged, setFocus, type Focus } from "src/shared/storage.ts";

/** which models get install chips (agent/spec.md "focus"); every change is saved at once */
export class FocusSvc {
  enabled = false;
  cond: RuleCond = emptyCond();
  isOpen = false;

  constructor() {
    makeAutoObservable(this);
    void getFocus().then((f) => this.apply(f));
    onFocusChanged((f) => this.apply(f));
  }

  apply(f: Focus): void {
    this.enabled = f.enabled;
    this.cond = f.cond;
  }

  /** the filter in force, null when focus is off or empty */
  get active(): RuleCond | null {
    return this.enabled && !isEmptyCond(this.cond) ? this.cond : null;
  }

  get label(): string {
    if (!this.enabled) return "Focus: off";
    const c = this.cond;
    const parts = [
      ...c.bases,
      ...c.types.map(typeName),
      ...c.tags.map((t) => `#${t}`),
      ...c.words.map((w) => `"${w}"`),
    ];
    if (parts.length === 0) return "Focus: all";
    return `Focus: ${parts.slice(0, 3).join(", ")}${parts.length > 3 ? ` +${parts.length - 3}` : ""}`;
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  close(): void {
    this.isOpen = false;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.save();
  }

  has(field: Exclude<CondField, "types">, v: string): boolean {
    return this.cond[field].some((x) => x.toLowerCase() === v.toLowerCase());
  }

  /** toggling a value on also turns focus on: picking what you care about means you want it applied */
  toggle(field: Exclude<CondField, "types">, raw: string): void {
    const v = field === "bases" ? raw.trim() : raw.trim().toLowerCase();
    if (v === "") return;
    this.cond[field] = this.has(field, v)
      ? this.cond[field].filter((x) => x.toLowerCase() !== v.toLowerCase())
      : [...this.cond[field], v];
    if (!this.has(field, v)) return this.save();
    this.enabled = true;
    this.save();
  }

  toggleType(t: LmPrefix): void {
    this.cond.types = this.cond.types.includes(t)
      ? this.cond.types.filter((x) => x !== t)
      : [...this.cond.types, t];
    if (this.cond.types.includes(t)) this.enabled = true;
    this.save();
  }

  clear(): void {
    this.cond = emptyCond();
    this.save();
  }

  private save(): void {
    void setFocus({ enabled: this.enabled, cond: toJS(this.cond) });
  }
}
