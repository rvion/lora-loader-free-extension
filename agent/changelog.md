# Changelog

Newest first. Each entry narrates WHAT changed and WHY, for the next
session that arrives with no context.

## 2026-09-23

- Server address editable from the card (⚙, and shown by itself when LM is
  unreachable) as well as the popup and the Options page. Saving normalizes
  host, ip:port or url, and every open card re-checks. Fixed "http://" being
  accepted as the host "http".

- v0.1.0: the Civitai card (library status, Download into a picked root and
  subfolder, Mark), the popup (LM URL + Test, marked list, Download all), the
  background LM client with the Origin strip rule. Built from LoRA Manager's
  open source API only (agent/lora-manager-api.md). Chrome only, by choice.

- Repo scaffolded: package.json, tsconfig, vscode tasks, agent/ wiki,
  shipkit wiring, first commit.
