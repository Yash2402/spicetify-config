# spicetify config

My [Spicetify](https://spicetify.app) setup: the **text** theme turned into a
terminal, with discrete line scrolling and a vim keyboard layer modelled on my
Neovim config.

- `Themes/text/` – theme (`user.css`, `color.ini`) plus `theme.js`, the terminal
  behaviour layer. Full key reference in [`Themes/text/README.md`](Themes/text/README.md)
  or press `?` inside Spotify.
- `CustomApps/` – Marketplace and Stats.
- `config-xpui.ini` – Spicetify settings (`inject_theme_js = 1` is required).
- `tools/` – live-reload workflow for working on the theme (see [Development](#development)).

## Setup

```sh
git clone <this repo> ~/.config/spicetify
spicetify apply
```

`Themes/spicetify-themes/` (the full upstream theme collection) is not tracked;
clone it separately if you want the other themes:

```sh
git clone https://github.com/spicetify/spicetify-themes ~/.config/spicetify/Themes/spicetify-themes
```

## Development

Two ways to see changes as you make them.

### Quick: Spicetify's watch mode

```sh
spicetify enable-devtools   # once; then ⌘⌥I inside Spotify opens Chrome DevTools
spicetify watch -s          # on every save of user.css / color.ini / theme.js: copy + reload Spotify
```

Simple, but every save reloads the Spotify page, so you lose your place.

### Live reload without reloading Spotify (`tools/`)

```sh
tools/spotify-debug.sh      # restart Spotify with the Chromium debugging port (keeps track + position)
node tools/dev.mjs          # watch theme.js + user.css and inject them on every save
```

`dev.mjs` connects to Spotify over the Chrome DevTools Protocol and, about
0.2 s after you save:

- re-runs `theme.js` in the open page; the previous copy switches itself off
  (the `__textTerminalId` guard at the top of `theme.js`), so the page, scroll
  position and music stay as they were
- swaps the part of `user.css` after the `TERMINAL BEHAVIOUR (theme.js)` marker
  into a `<style>` tag
- prints `injected (theme.js)` or the JavaScript error if the file doesn't parse

Edits above that marker in `user.css`, or in `color.ini`, still need
`spicetify watch -s` or `spicetify apply`.

When you're done:

```sh
spicetify apply             # install the changes for real (injection is lost on restart)
tools/spotify-debug.sh off  # restart Spotify normally and close the debugging port
```

> While Spotify runs with the debugging port open, any program on this Mac can
> control it and read its session — always finish with `tools/spotify-debug.sh off`.

Requirements: Node 22+ (for the built-in `WebSocket`), macOS (`osascript` is
used to save and restore playback). Set `SPOTIFY_DEBUG_PORT` to use a port
other than 9222.

## Notes

- Leader key is a tap of **right ⌘**; Space stays Spotify's play/pause.
- Stats is built from [Mossbraker/spicetify-apps](https://github.com/Mossbraker/spicetify-apps)
  (open PR harbassan/spicetify-apps#246), because the official stats-v1.1.3
  crashes on current Spotify. Most tabs need a Last.fm API key or your own
  Spotify developer app (set in the Stats settings).
