// the hub's stores desk for the Chrome Web Store listing (.shipkit/chrome-web-store/): the ask that walks the
// dashboard, and « make again » for the zip, the icon and the tiles. The screenshots need a live LoRA Manager, so
// they stay `bun run release:shots`
import { stores } from 'rvlib-shipkit/src/stores/unit.ts'

export default stores({
    'chrome-web-store': { ask: '002-fill-the-chrome-web-store-listing-and-submit' },
    render: { 'chrome-web-store': { cmd: ['bun', 'run', 'release:files'], about: 'about 5 s' } },
})
