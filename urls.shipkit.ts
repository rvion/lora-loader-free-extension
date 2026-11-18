// where the extension is live: its repository and the releases it installs from (README.md)
import { urls } from 'rvlib-shipkit/src/shipkit-files.ts'

export default urls([
    { id: 'lora-loader-github', label: 'the repository', env: 'prod', url: 'https://github.com/rvion/lora-loader-free-extension' },
    { id: 'lora-loader-releases', label: 'the releases', env: 'prod', url: 'https://github.com/rvion/lora-loader-free-extension/releases' },
])
