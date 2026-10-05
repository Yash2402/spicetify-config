# text

## Screenshots

#### Display Images

##### with images

![withimg](screenshots/withimg.png)

##### without images

![withoutimg](screenshots/withoutimg.png)

### Spotify

![Spotify](screenshots/Spotify.png)

### Spicetify

![Spicetify](screenshots/Spicetify.png)

### CatppuccinMocha

![CatppuccinMocha](screenshots/CatppuccinMocha.png)

### CatppuccinMacchiato

![CatppuccinMacchiato](screenshots/CatppuccinMacchiato.png)

### CatppuccinLatte

![CatppuccinLatte](screenshots/CatppuccinLatte.png)

### Dracula

![Dracula](screenshots/Dracula.png)

### Gruvbox

![Gruvbox](screenshots/Gruvbox.png)

### GruvboxHard

![GruvboxHard](screenshots/GruvboxHard.png)

### Kanagawa

![Kanagawa](screenshots/Kanagawa.png)

### Nord

![Nord](screenshots/Nord.png)

### Rigel

![CatppuccinMaRigelcchiato](screenshots/Rigel.png)

### RosePine

![RosePine](screenshots/RosePine.png)

### RosePineMoon

![RosePineMoon](screenshots/RosePineMoon.png)

### RosePineDawn

![RosePineDawn](screenshots/RosePineDawn.png)

### Solarized

![Solarized](screenshots/Solarized.png)

### TokyoNight

![TokyoNight](screenshots/TokyoNight.png)

### TokyoNightStorm

![TokyoNightStorm](screenshots/TokyoNightStorm.png)

### ForestGreen

![ForestGreen](screenshots/ForestGreen.png)

### EverforestDarkHard

![EverforestDarkHard](screenshots/EverforestDarkHard.png)

### EverforestDarkMedium

![EverforestDarkMedium](screenshots/EverforestDarkMedium.png)

### EverforestDarkSoft

![EverforestDarkSoft](screenshots/EverforestDarkSoft.png)

### FlexokiLight

![FlexokiLight](screenshots/FlexokiLight.png)

### FlexokiDark

![FlexokiDark](screenshots/FlexokiDark.png)

### BloodMoon

![BloodMoon](screenshots/BloodMoon.png)

## More

### Description

a spicetify theme that mimics the look of [spotify-tui](https://github.com/Rigellute/spotify-tui)

### Credits

created by [darkthemer](https://github.com/darkthemer/)

### Notes

-   **SUGGESTION:** Feel free to edit `color.ini` to swap the accent color (it's green for most of them) into your preferred color based from the color pallete.

    -   https://github.com/catppuccin/catppuccin
    -   https://github.com/dracula/dracula-theme
    -   https://github.com/morhetz/gruvbox
    -   https://github.com/rebelot/kanagawa.nvim
    -   https://github.com/nordtheme/nord
    -   https://github.com/Rigellute/rigel
    -   https://github.com/rose-pine/rose-pine-theme
    -   https://github.com/altercation/solarized
    -   https://github.com/enkia/tokyo-night-vscode-theme
    -   https://github.com/sainnhe/everforest

-   **SUGGESTION:** Check the very top of `user.css` for user settings

    -   If you use the Marketplace, go to `Marketplace > Snippets > + Add CSS` and then paste the variables found in `user.css` (also below). Edit these as you wish. If you're following this method, don't forget to add `!important` at the end of each property.

```css
/* user settings */
:root {
    --font-family: "JetBrains Mono", monospace;
    /*
    --font-family: 'Anonymous Pro', monospace;
    --font-family: 'Azeret Mono', monospace;
    --font-family: 'B612 Mono', monospace;
    --font-family: 'Courier Prime', monospace;
    --font-family: 'Cousine', monospace;
    --font-family: 'Cutive Mono', monospace;
    --font-family: 'DM Mono', monospace;
    --font-family: 'Fira Code', monospace;
    --font-family: 'Fira Mono', monospace;
    --font-family: 'IBM Plex Mono', monospace;
    --font-family: 'JetBrains Mono', monospace;
    --font-family: 'M PLUS 1 Code', monospace;
    --font-family: 'Major Mono Display', monospace;
    --font-family: 'Monofett', monospace;
    --font-family: 'Nova Mono', monospace;
    --font-family: 'Overpass Mono', monospace;
    --font-family: 'Oxygen Mono', monospace;
    --font-family: 'PT Mono', monospace;
    --font-family: 'Roboto Mono', monospace;
    --font-family: 'Share Tech Mono', monospace;
    --font-family: 'Sometype Mono', monospace;
    --font-family: 'Sono', monospace;
    --font-family: 'Source Code Pro', monospace;
    --font-family: 'Space Mono', monospace;
    --font-family: 'Syne Mono', monospace;
    --font-family: 'Ubuntu Mono', monospace;
    --font-family: 'VT323', monospace;
    --font-family: 'Xanh Mono', monospace;
    */
    --font-size: 14px;
    --font-weight: 400; /* 200 : 900 */
    --line-height: 1.2;

    --font-size-lyrics: 14px; /* 1.5em (default) */

    --font-family-header: "asciid";
    --font-size-multiplier-header: 4;

    --display-card-image: block; /* none | block */
    --display-coverart-image: none; /* none | block */
    --display-header-image: none; /* none | block */
    --display-sidebar-image: block; /* none | block */
    --display-tracklist-image: none; /* none | block */
    --display-spicetify-banner-ascii: block; /* none | block */
    --display-music-banner-ascii: none; /* none | block */

    --border-radius: 0px;
    --border-width: 1px;
    --border-style: solid; /* dotted | dashed | solid | double | groove | ridge | inset | outset */
    --border-transition: 0.2s ease; /* 'none' to disable  */

    --global-nav-margin-top: 50px; /* set to '0px' if you disabled window controls */
}
```

-   **SUGGESTION:** For Windows users, here's how to make the window controls' background match with the topbar background

    -   Enable [CEF/Spotify Tweaks](https://windhawk.net/mods/cef-titlebar-enabler-universal) in Windhawk (recommended)

    -   Alternatively, Put this snippet into your `user.css` (or through the Marketplace's `+ Add CSS` feature)

```css
/* transparent window controls background */
.spotify__container--is-desktop:not(.fullscreen) body::after {
    content: "";
    position: absolute;
    right: 0;
    z-index: 999;

    backdrop-filter: brightness(2.12);
    /* page zoom [ctrl][+] or [ctrl][-]
       edit width and height accordingly */
    width: 135px;
    /* depending on what global status bar
       style is enabled height need to be
       changed accordingly. */
    height: 64px;
}
```

![winctrl](screenshots/winctrl.png)

## Terminal behaviour (`theme.js`)

Needs `inject_theme_js = 1` in `config-xpui.ini` (then `spicetify apply`).
To work on it with live reload, see [Development](../../README.md#development) (`tools/spotify-debug.sh` + `node tools/dev.mjs`).

- **Discrete scrolling**: one wheel notch (or 40px of trackpad travel) moves one line. In lists a line is one row and the view snaps to row boundaries. Smooth `scrollTo`/`scrollIntoView` calls are forced to instant.
- **Vim normal mode**, mirroring `~/.config/nvim` (leader **right ⌘**, `scrolloff=8`, `relativenumber`, `<C-d>`/`<C-u>` + `zz`, `n`/`N` + `zz`, harpoon). Press `?` in Spotify for the list.

One small set of keys works at every level: **pane → item → the controls inside it → menus/dialogs**. `<CR>` steps in, `<Esc>` steps out, `hjkl` move by screen position at whatever level you are on. The statusline shows where you are, e.g. `NORMAL │ main › No Other Heart › Mac DeMarco │ 4/8 │ Top`.

| keys | action |
| --- | --- |
| `j` `k` `h` `l` | move: rows / cards in a pane, controls inside an item, entries in a menu (counts: `5j`) |
| `<CR>` | step into the highlighted item; on a control press it; on a slider grab it. Titles count as controls: in a Library row `<CR>` `l` `<CR>` opens the playlist instead of playing it |
| `<Esc>` `<BS>` | step back out one level (closes submenus, menus, dialogs) |
| `-` | up one level, like netrw: same as `<Esc>` inside items, menus and dialogs; in the Library it also leaves a folder you opened |
| `o` | play / open / press at any level without stepping in |
| `K` | right-click menu of the highlighted thing; in menus `l`/`<CR>` open a submenu, `h` closes it |
| `i` `a` | type into the current box (menu filter, dialog field), else the Spotify search; `<Esc>` `<C-c>` `<C-[>` leave it |
| `H` `L`, `<C-w>h/l/w` | focus pane left / right / next (Library, Main, Sidebar) |
| `<C-w>k` `<C-w>j` | up to the top bar / down to the player bar (press again to go back) |
| `<leader>f` `n` `b` `q` `u` | open friends (Listening activity), What's New, Browse, the queue, the profile menu |
| slider grabbed | `h` `l` seek 5 s or volume 5 % (`6l` = +30 s) |
| `gg` `G` `:N` | first / last (item or control) / Nth item |
| `<C-d>` `<C-u>` `<C-f>` `<C-b>` `<C-y>` | half page (+zz), page, line scroll |
| `zz` `zt` `zb` | cursor line to center / top / bottom |
| `<C-o>` `<C-i>` | history back / forward |
| `/` `n` `N` | search visible items |
| `V` | visual line mode on any track or episode list (playlists, albums, Liked Songs, artist, search, podcast shows, Your Episodes): `j` `k` extend, `o` jumps to the other end, `<Esc>` leaves |
| `V` … `J` `K` | move the selected tracks down / up (your own playlists, sorted by Custom order; `5J` moves 5) |
| `V` … `d` / `y` | remove the selection (your playlists; unlike in Liked Songs; unsave in Your Episodes) / yank its links |
| `u` | undo the last move, remove or `:w` |
| `V` … `:'<,'>w name` | write the selection to a new playlist (`:w name` without a selection writes the whole list) |
| `V` … `:'<,'>w >> name` | append the selection to one of your playlists |
| `<leader>` | tap **right ⌘** (press + release), then the key. `<Space>` is Spotify's own play/pause again |
| `<leader><leader>` | play / pause (double-tap right ⌘) |
| `<leader>h` `<leader>l` | previous / next tab or filter of the focused pane (Home chips, Library filters, Marketplace tabs) |
| `<leader>1-9` `<leader>0` | custom app N (marketplace, stats) / home |
| `<leader>[` `<leader>]` | page back / forward |
| `<leader>pv` | Your Library pane |
| `<leader>y` `<leader>Y` | yank link of item / page |
| `<leader>a`, `<C-e>`, `<C-h>` `<C-t>` `<C-n>` `<C-s>` | harpoon mark / menu / jump 1-4 |
| `<C-k>` `<C-j>` | next / previous track |
| `:friends` `:news` `:browse` `:queue` `:lyrics` `:profile` | open those panels |
| `:e q` `:next` `:prev` `:play` `:vol N` `:seek 1:23` `:shuffle` `:repeat` `:like` `:home` `:set nornu` `:set so=N` | commands |

Settings live in the `CFG` object at the top of `theme.js`.
