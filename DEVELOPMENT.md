# Development

## Requirements

- **OS**: Any platform that supports Node.js (Linux, macOS, Windows)
- **Node.js**: v18 or later — [install instructions](https://nodejs.org/)
- **npm**: comes bundled with Node.js

## Setup

```bash
git clone https://github.com/avinal/sciezka.git
cd sciezka
npm install
```

## Build

```bash
npm run build
```

This runs `node build.mjs`, which uses [esbuild](https://esbuild.github.io/) to compile three TypeScript entry points (`src/background.ts`, `src/content.ts`, `src/sciezka.ts`) into bundled JavaScript files in the `dist/` directory. No minification or obfuscation is applied.

The built extension files are:
- `dist/background.js` — background service worker
- `dist/content.js` — content script
- `dist/sciezka.js` — search UI logic

## Other commands

- `npm run watch` — rebuild on file changes
- `npm run typecheck` — run TypeScript type checking
- `npm run lint` — validate extension with web-ext

## Loading in Firefox

Load as a temporary extension: `about:debugging` > This Firefox > Load Temporary Add-on > select `manifest.json`.

## Packaging for Firefox

To create a `.zip` (which Firefox also accepts as `.xpi`) for sideloading:

```bash
npm run build
npx web-ext build --source-dir . --artifacts-dir ./artifacts --overwrite-dest \
  --ignore-files "src/" "tsconfig.json" "build.mjs" "package.json" \
  "package-lock.json" "node_modules/" "artifacts/" ".github/"
```

This produces `artifacts/sciezka-<version>.zip`. To install it in Firefox, go to `about:addons` > gear icon > Install Add-on From File.

## Browser compatibility

Currently Firefox-only. Chrome MV3 requires `background.service_worker` instead of `background.scripts`, so the manifest would need changes to support Chrome-based browsers.
