import { defineRepo } from 'rvlib-shipkit/src/repo-config.ts'

export default defineRepo({
    // >>> shipkit ignored inputs — managed block, the traced audit writes it, edit outside the markers
    ignoredInputs: {
        test: [
            'dist/**',
        ],
    },
    // <<< shipkit ignored inputs
    identity: { colorLight: '#2193a1', colorDark: '#77d8e3' },
    name: 'lora-loader-free-extension',
    visibility: 'public',
    venues: [], // e.g. ['itch', 'steam'], selects which .shipkit/<venue>/ contracts are REQUIRED
    social: [], // e.g. ['x', 'discord'], the .shipkit/social/<channel>/ post folders (+ .shipkit/discord/)
    tasks: [],  // repo commit-gate tasks; deps double as race guards
    // lint, typecheck, imports:check and cycles are cached on the tracked tree.
    // `test` runs every time until you say what it reads, because an
    // ignored path (a fixture, a local db, a .env) is not in a tree key:
    // defaults: { test: { inputs: ['tests', 'src', 'package.json'] } },
    // staged paths that may never enter git: local state, big derived output, a
    // dump naming something private. gitignore (SK004) is advisory and editable,
    // this pre-commit gate is not
    hooks: { blockedPaths: ['.comfy-ts/hosts/', '.comfy-ts/cache/', '.comfy-ts/outputs/'] },
    // the declared reviewer agent type (rule SK008). Uncomment with YOUR
    // standing brief, then `shipkit check --fix SK008` writes the agent file:
    // reviewer: { name: 'my-reviewer', brief: '~/path/to/reviewer-brief.md' },
    // checks need no config. Drop a <name>.check.ts file anywhere, and
    // `shipkit ci`, `shipkit check` and the hub discover it
    // every key this file accepts, one line each: `shipkit config-keys`
})
