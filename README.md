# spicetify config

My [Spicetify](https://spicetify.app) setup: the **text** theme turned into a
terminal, with discrete line scrolling and a vim keyboard layer modelled on my
Neovim config.

- `Themes/text/` – theme (`user.css`, `color.ini`) plus `theme.js`, the terminal
  behaviour layer. Full key reference in [`Themes/text/README.md`](Themes/text/README.md)
  or press `?` inside Spotify.
- `CustomApps/` – Marketplace and Stats.
- `config-xpui.ini` – Spicetify settings (`inject_theme_js = 1` is required).

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

## Notes

- Leader key is a tap of **right ⌘**; Space stays Spotify's play/pause.
- Stats is built from [Mossbraker/spicetify-apps](https://github.com/Mossbraker/spicetify-apps)
  (open PR harbassan/spicetify-apps#246), because the official stats-v1.1.3
  crashes on current Spotify. Most tabs need a Last.fm API key or your own
  Spotify developer app (set in the Stats settings).
