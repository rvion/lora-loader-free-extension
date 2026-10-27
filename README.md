# Civitai to LoRA Manager (unofficial)

A Chrome extension for civitai.com. On every model page and model card it
shows whether that model is already in your
[LoRA Manager](https://github.com/willmiao/ComfyUI-Lora-Manager) library, and
downloads it into the root and subfolder you pick in one click. It talks only
to LoRA Manager's HTTP API, on the address you give it.

Not affiliated with Civitai or with LoRA Manager.

## Install

1. Download the zip from the latest
   [release](https://github.com/rvion/lora-loader-free-extension/releases)
   and unzip it (or build it: `bun install && bun run build` → `dist/`).
2. chrome://extensions → Developer mode → Load unpacked → pick the folder.
3. Open the popup and set your LoRA Manager address (for example
   `localhost:8188`), then Test. An address on another machine asks
   Chrome's permission once.

LoRA Manager must run, as a ComfyUI plugin or standalone.

The "improve experience" button on the bar hides Civitai's ads. It is off
by default.

[Privacy policy](PRIVACY.md)

## License

MIT
