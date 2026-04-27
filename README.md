# Sciezka

A fast, Spotlight-style browser extension for searching tabs, history, bookmarks, and recently closed tabs. Built with vanilla TypeScript — no framework dependencies.

*Sciezka* means "path" in Polish.

## Why?

I relied on [Saka](https://github.com/lusakasa/saka) for years to quickly jump between tabs, search history, and find bookmarks — all from the keyboard. It stopped being maintained. I couldn't find a replacement that was as fast and keyboard-driven, so I built one.

## Features

- **Fuzzy search** across open tabs, browsing history, bookmarks, and recently closed tabs
- **Three search methods**: fuzzy (fzy algorithm), full-text, and prefix matching
- **Keyboard-driven**: navigate entirely with keyboard shortcuts
- **Spotlight-style overlay**: appears on any page without leaving your current context
- **Match highlighting**: matched characters highlighted in search results
- **Configurable**: set default search method and mode order via the options page

### From source

```bash
git clone https://github.com/avinal/sciezka.git
cd sciezka
```

Load as a temporary extension in Firefox: `about:debugging` > This Firefox > Load Temporary Add-on > select `manifest.json`.

## Usage

Press **Ctrl+Space** to open the search overlay on any page.

| Key | Action |
|---|---|
| `Ctrl+Space` | Toggle open/close |
| `Esc` | Close |
| `Up/Down` | Navigate results |
| `Enter` | Open selected result |
| `Ctrl+Shift+Enter` | Open in new tab |
| `Tab` / `Shift+Tab` | Cycle through modes |
| `Ctrl+F` | Cycle search method (fuzzy / full-text / prefix) |
| `Ctrl+D` | Close selected tab (Tabs mode only) |

### Modes

- **Tabs** — open tabs in all windows
- **History** — browsing history
- **Bookmarks** — saved bookmarks
- **Closed** — recently closed tabs

## Building

### Requirements

- **OS**: Any platform that supports Node.js (Linux, macOS, Windows)
- **Node.js**: v18 or later — [install instructions](https://nodejs.org/)
- **npm**: comes bundled with Node.js

### Build steps

```bash
git clone https://github.com/avinal/sciezka.git
cd sciezka
npm install
npm run build
```

`npm run build` runs `node build.mjs`, which uses [esbuild](https://esbuild.github.io/) to compile three TypeScript entry points (`src/background.ts`, `src/content.ts`, `src/sciezka.ts`) into bundled JavaScript files in the `dist/` directory. No minification or obfuscation is applied.

The built extension files are:
- `dist/background.js` — background service worker
- `dist/content.js` — content script
- `dist/sciezka.js` — search UI logic

Other commands:
- `npm run watch` — rebuild on file changes
- `npm run typecheck` — run TypeScript type checking
- `npm run lint` — validate extension with web-ext

### Packaging for Firefox

To create a `.zip` (which Firefox also accepts as `.xpi`) for sideloading:

```bash
npm run build
npx web-ext build --source-dir . --artifacts-dir ./artifacts --overwrite-dest \
  --ignore-files "src/" "tsconfig.json" "build.mjs" "package.json" \
  "package-lock.json" "node_modules/" "artifacts/" ".github/"
```

This produces `artifacts/sciezka-<version>.zip`. To install it in Firefox, go to `about:addons` > gear icon > Install Add-on From File.

## License

MIT

## Disclaimer

I have no practical knowledge of working with TypeScript or Mozilla Extensions. I created this extention mostly using Claude because the one I was using is not longer maintained. I hope to maintain this for long time. If you find any issues/concerns please feel free to contact me or open an issue.
