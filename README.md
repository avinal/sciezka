# Sciezka

A fast, Spotlight-style browser extension for searching tabs, history, bookmarks, and recently closed tabs. Built with vanilla TypeScript — no framework dependencies.

*Sciezka* means "path" in Polish.

**[Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/sciezka/)**

## Why?

I relied on [Saka](https://github.com/lusakasa/saka) for years to quickly jump between tabs, search history, and find bookmarks — all from the keyboard. It stopped being maintained. I couldn't find a replacement that was as fast and keyboard-driven, so I built one.

## Features

- **Fuzzy search** across open tabs, browsing history, bookmarks, and recently closed tabs
- **Three search methods**: fuzzy (fzy algorithm), full-text, and prefix matching
- **Keyboard-driven**: navigate entirely with keyboard shortcuts
- **Spotlight-style overlay**: appears on any page without leaving your current context
- **Match highlighting**: matched characters highlighted in search results
- **Duplicate tab detection**: find and close duplicate tabs with configurable URL matching
- **Stale tab detection**: surface forgotten tabs based on time, count, or both
- **Result count**: live count of results displayed in the mode bar
- **Dark mode**: follows system preference
- **Configurable**: search method, mode order, duplicate matching, and stale detection settings via the options page or inline config panel

## Usage

Press **Ctrl+Space** to open the search overlay on any page.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+Space` | Toggle open/close |
| `Esc` | Close |
| `Up` / `Down` | Navigate results |
| `Enter` | Open selected result |
| `Tab` / `Shift+Tab` | Cycle through modes |
| `Ctrl+1` to `Ctrl+6` | Jump to mode by position |
| `Ctrl+F` | Cycle search method (fuzzy / full-text / prefix) |
| `Ctrl+D` | Close selected tab (Tabs / Duplicates / Stale modes) |

### Modes

- **Tabs** — all open tabs across all windows. Switch to any tab or close it with `Ctrl+D`.
- **History** — browsing history. Shows up to 100 most recent entries; Firefox searches your full history when you type a query.
- **Bookmarks** — saved bookmarks. Open in current tab or new tab.
- **Closed** — recently closed tabs, limited to 25 by Firefox's `browser.sessionstore.max_tabs_undo` setting. Select to restore.
- **Duplicates** — shows one entry per duplicated URL with a count badge (e.g., ×3). `Ctrl+D` closes all duplicates of the selected URL, keeping the most recently accessed tab. URL matching is configurable: exact, ignore hash fragment, or ignore query string.
- **Stale** — tabs not accessed within a configurable time window, sorted oldest-first. Three detection methods:
  - **Time** — all tabs older than a threshold (default: 4 weeks)
  - **Count** — the N least recently accessed tabs (default: 100)
  - **Time + Cap** — tabs older than the threshold, capped at N results

### Settings

Open the settings gear icon in the search bar or go to `about:addons` > Sciezka > Preferences.

- **Default mode** — which mode to show on open
- **Default search method** — fuzzy, full-text, or prefix
- **Duplicate matching** — how to compare URLs (exact, ignore hash, ignore query)
- **Stale detection** — method (time/count/both), threshold with unit (hours/days/weeks), and max count
- **Mode order** — drag to reorder modes in the inline config panel

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for build instructions, packaging, and browser compatibility notes.

## License

MIT
