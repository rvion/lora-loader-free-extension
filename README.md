# LoRA Manager Free

A Chrome extension for civitai.com. On every model page and model card it
shows whether that model is already in your
[LoRA Manager](https://github.com/willmiao/ComfyUI-Lora-Manager) library, and
downloads it into the root and subfolder you pick in one click. It talks only
to LoRA Manager's HTTP API, on the address you give it.

## Install

1. `bun install && bun run build` → `dist/`
2. chrome://extensions → Developer mode → Load unpacked → pick `dist/`
3. Open the popup and set your LoRA Manager address (for example
   `localhost:8188`), then Test.

LoRA Manager must run, as a ComfyUI plugin or standalone.

## License

MIT
