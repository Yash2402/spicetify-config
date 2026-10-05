// text — terminal behaviour layer
//
// Spotify scrolls like a GUI: the wheel/trackpad moves content pixel by pixel
// with inertia, and parts of the app call scrollTo/scrollIntoView with
// behavior:"smooth". This file replaces that with terminal semantics:
//
//   * discrete scrolling - every wheel notch (or 40px of trackpad travel) moves
//     exactly one line; inside lists a line is one row and the view snaps to
//     row boundaries
//   * no smooth scrolling anywhere (scroll APIs are forced to "instant")
//   * a vim normal mode modelled on ~/.config/nvim (leader = tap right ⌘,
//     scrolloff = 8, relativenumber, <C-d>/<C-u> + zz, n/N + zz, harpoon on
//     <leader>a / <C-e> / <C-h><C-t><C-n><C-s>, quickfix-style <C-k>/<C-j>)
//
// Press ? inside Spotify for the full list of bindings.

(function textTerminal() {
    "use strict";

    if (!document.querySelector(".Root__main-view") || !document.body) {
        setTimeout(textTerminal, 300);
        return;
    }
    if (window.__textTerminal) return;
    window.__textTerminal = true;
    // re-running this file (e.g. live reload while hacking on it) retires the previous copy
    const ME = (window.__textTerminalId = (window.__textTerminalId || 0) + 1);
    const alive = () => window.__textTerminalId === ME;
    document.querySelectorAll("#tt-status, #tt-cmdline, #tt-overlay").forEach((n) => n.remove());

    const CFG = {
        leader: "<leader>", // tap right ⌘ (Space is a native Spotify menu shortcut, the page never gets it first)
        timeoutlen: 1000, // ms to wait for the rest of a mapping
        scrolloff: 8, // rows kept visible above/below the cursor
        relativenumber: true,
        mousescroll: 1, // lines per wheel notch
        pixelsPerLine: 40, // trackpad travel that counts as one notch
    };

    const S = () => window.Spicetify || {};
    const History = () => S().Platform?.History;
    const Player = () => S().Player;

    /* ================================
       SMOOTH SCROLLING -> INSTANT
       ================================ */

    const instant = (opts) => (opts && typeof opts === "object" && opts.behavior === "smooth" ? { ...opts, behavior: "instant" } : opts);
    for (const target of [Element.prototype, window]) {
        for (const fn of ["scrollTo", "scrollBy", "scroll"]) {
            const orig = target[fn];
            if (typeof orig !== "function") continue;
            target[fn] = function (a, ...rest) {
                return orig.call(this, instant(a), ...rest);
            };
        }
    }
    const origIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (arg) {
        return origIntoView.call(this, instant(arg));
    };

    /* ================================
       DOM HELPERS
       ================================ */

    const PANES = [
        { name: "library", sel: ".Root__nav-bar", extra: "" },
        { name: "main", sel: ".Root__main-view", extra: "" },
        { name: "sidebar", sel: ".Root__right-sidebar", extra: ",li" }, // friend activity / queue
        { name: "player", sel: ".Root__now-playing-bar", extra: "" }, // controls + sliders, moved spatially
    ];
    const ITEM_SEL = [
        '[role="row"][aria-rowindex]',
        '[data-encore-id="card"]',
        ".main-card-card", // older card markup, reused by Spicetify apps (Marketplace...)
        'div:has(> [data-testid="shortcut-background"])',
        '[role="listitem"]',
    ].join(",");

    const paneEl = (name) => document.querySelector(PANES.find((p) => p.name === name).sel);
    const visiblePanes = () =>
        PANES.filter((p) => {
            const el = document.querySelector(p.sel);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 40 && r.height > 40;
        }).map((p) => p.name);
    const paneOf = (node) => PANES.find((p) => node.closest?.(p.sel))?.name;

    const textLine = () => parseFloat(getComputedStyle(document.body).lineHeight) || 17;

    function isScrollable(n) {
        const oy = getComputedStyle(n).overflowY;
        return (oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight > n.clientHeight + 1;
    }
    function scrollerOf(el) {
        for (let n = el?.parentElement; n && n !== document.documentElement; n = n.parentElement) if (isScrollable(n)) return n;
        return null;
    }
    // scroller of a pane: the one that holds its items, or the largest one
    function paneScroller(name) {
        const p = paneEl(name);
        if (!p) return null;
        const item = getItems(name)[0];
        if (item) return scrollerOf(item);
        let best = null;
        for (const n of p.querySelectorAll("[data-overlayscrollbars-viewport], div")) {
            if (isScrollable(n) && (!best || n.clientHeight > best.clientHeight)) best = n;
            if (best && n.hasAttribute("data-overlayscrollbars-viewport")) break;
        }
        return best;
    }

    function getItems(name) {
        const p = paneEl(name);
        if (!p) return [];
        const out = [];
        const sel = ITEM_SEL + PANES.find((x) => x.name === name).extra;
        for (const el of p.querySelectorAll(sel)) {
            if (el.offsetHeight < 8) continue; // virtualisation spacers / hidden header rows
            if (el.querySelector('[role="columnheader"]')) continue; // tracklist header
            if (el.parentElement.closest(sel)) continue; // nested (card inside a row)
            if (el.matches('[role="row"]') && el.querySelector(ITEM_SEL)) continue; // row wrapping cards
            out.push(el);
        }
        if (out.length) return out;
        // panes with none of the above (player bar, settings, other custom apps):
        // every control becomes an item and hjkl move spatially between them
        const generic = controls(p).filter((el) => !el.closest(".main-topBar-container"));
        generic.generic = true;
        return generic;
    }

    // area hidden behind sticky headers / the floating top bar
    function topInset(sc) {
        let inset = 0;
        for (const h of sc.querySelectorAll(".main-trackList-trackListHeader")) {
            const cs = getComputedStyle(h);
            if (cs.position === "sticky") inset = Math.max(inset, (parseFloat(cs.top) || 0) + h.offsetHeight);
        }
        const pane = sc.closest(".Root__main-view");
        const bar = pane?.querySelector(".main-topBar-container");
        if (bar) inset = Math.max(inset, bar.offsetHeight);
        return Math.min(inset, sc.clientHeight / 3);
    }
    function view(sc) {
        const r = sc.getBoundingClientRect();
        const inset = topInset(sc);
        return { top: r.top + inset, bottom: r.top + sc.clientHeight, height: sc.clientHeight - inset };
    }

    // one "line" of a scroller: a row in lists, a text line elsewhere
    function lineStep(sc) {
        const v = view(sc);
        for (const el of sc.querySelectorAll('[role="row"][aria-rowindex]')) {
            const r = el.getBoundingClientRect();
            if (r.height >= 8 && r.bottom > v.top && !el.querySelector('[role="columnheader"]')) return { step: r.height, rows: true };
            if (r.top > v.bottom) break;
        }
        return { step: textLine(), rows: false };
    }

    // after a row-based scroll, snap a row that is cut by the top edge to the
    // nearest row boundary so the list stays on a character grid
    function snapRows(sc) {
        const v = view(sc);
        for (const el of sc.querySelectorAll('[role="row"][aria-rowindex]')) {
            const r = el.getBoundingClientRect();
            if (r.height < 8 || el.querySelector('[role="columnheader"]')) continue;
            if (r.bottom <= v.top + 1) continue;
            const d = r.top - v.top; // < 0: row is cut by the top edge
            if (d < -1) sc.scrollTop = Math.round(sc.scrollTop + (-d < r.height / 2 ? d : d + r.height));
            return;
        }
    }

    function scrollLines(sc, lines) {
        if (!sc || !lines) return;
        const { step, rows } = lineStep(sc);
        sc.scrollTop = Math.round(sc.scrollTop + lines * step);
        if (rows) snapRows(sc);
    }

    /* ================================
       CURSOR
       ================================ */

    const cursors = { library: {}, main: {}, sidebar: {}, player: {} };
    let active = "main";

    function keyOf(el) {
        const ri = el.getAttribute("aria-rowindex");
        if (!ri) return null;
        return { grid: el.closest('[role="grid"]')?.getAttribute("aria-label") ?? "", ri };
    }
    function findByKey(name, key) {
        const p = paneEl(name);
        if (!p || !key) return null;
        for (const el of p.querySelectorAll(`[role="row"][aria-rowindex="${key.ri}"]`)) {
            if ((el.closest('[role="grid"]')?.getAttribute("aria-label") ?? "") === key.grid && el.offsetHeight >= 8) return el;
        }
        return null;
    }
    function cursorEl(name = active) {
        const c = cursors[name];
        if (c.el?.isConnected && c.el.offsetHeight >= 8) return c.el;
        const el = findByKey(name, c.key);
        if (el) {
            c.el = el;
            el.setAttribute("data-tt-cursor", "");
        }
        return el;
    }

    function ensureVisible(el, mode = "off") {
        const sc = scrollerOf(el);
        if (!sc) return;
        const r = el.getBoundingClientRect();
        const v = view(sc);
        const off = Math.min(CFG.scrolloff * r.height, Math.max(0, (v.height - r.height) / 2));
        let d = 0;
        if (mode === "center") d = r.top + r.height / 2 - (v.top + v.height / 2);
        else if (mode === "top") d = r.top - (v.top + off);
        else if (mode === "bottom") d = r.bottom - (v.bottom - off);
        else if (r.top < v.top + off) d = r.top - (v.top + off);
        else if (r.bottom > v.bottom - off) d = r.bottom - (v.bottom - off);
        if (d) sc.scrollTop = Math.round(sc.scrollTop + d);
    }

    function setCursor(name, el, mode = "off", scroll = true) {
        if (name === active && scopes.length && scopes[0].el !== el) leaveAll();
        const c = cursors[name];
        if (c.el && c.el !== el) c.el.removeAttribute("data-tt-cursor");
        document.querySelectorAll("[data-tt-cursor]").forEach((n) => n !== el && paneOf(n) === name && n.removeAttribute("data-tt-cursor"));
        c.el = el;
        c.key = el ? keyOf(el) : null;
        c.want = undefined;
        if (!el) return render();
        el.setAttribute("data-tt-cursor", "");
        if (scroll) ensureVisible(el, mode);
        render();
    }

    // where a fresh cursor lands: the first item outside the scrolloff zone
    function firstVisible(items, name) {
        const sc = paneScroller(name);
        if (!sc) return items[0];
        const v = view(sc);
        const visible = items.filter((el) => el.getBoundingClientRect().top >= v.top - 1);
        if (!visible.length) return items[0];
        if (sc.scrollTop <= 0) return visible[0];
        const h = visible[0].offsetHeight;
        const off = Math.min(CFG.scrolloff * h, Math.max(0, (v.height - h) / 2));
        return visible.find((el) => el.getBoundingClientRect().top >= v.top + off - 1) || visible[0];
    }

    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // group items into visual rows: a tracklist gives one item per row, a home
    // shelf / followers grid gives several cards side by side
    function rowsOf(items) {
        const rows = [];
        for (const el of items) {
            const r = el.getBoundingClientRect();
            const last = rows[rows.length - 1];
            if (last && Math.abs(last.top - r.top) < Math.max(4, r.height / 4) && r.left > last.right - 2) {
                last.items.push(el);
                last.right = r.right;
            } else rows.push({ top: r.top, right: r.right, items: [el] });
        }
        return rows.map((row) => row.items);
    }
    const centerX = (el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2;
    };
    // item in a row closest to the remembered column (vim's curswant)
    const nearest = (row, x) => row.reduce((best, el) => (Math.abs(centerX(el) - x) < Math.abs(centerX(best) - x) ? el : best));

    // move the cursor n rows; walks past the end of virtualised lists by
    // scrolling and waiting for Spotify to render the next rows
    let moveToken = 0;
    async function move(n, mode = "off") {
        const token = ++moveToken;
        const name = active;
        let remaining = n;
        for (let guard = 0; guard < 400 && remaining; guard++) {
            const items = getItems(name);
            if (!items.length) {
                scrollLines(paneScroller(name), remaining);
                return;
            }
            let cur = cursorEl(name);
            if (!items.includes(cur)) cur = firstVisible(items, name);
            const want = cursors[name].want ?? centerX(cur);
            const rows = rowsOf(items);
            const ri = rows.findIndex((row) => row.includes(cur));
            const target = ri + remaining;
            if (target >= 0 && target < rows.length) {
                setCursor(name, nearest(rows[target], want), mode);
                cursors[name].want = want;
                return;
            }
            const edge = target < 0 ? 0 : rows.length - 1;
            const edgeEl = nearest(rows[edge], want);
            if (edge === ri && guard > 0) {
                setCursor(name, edgeEl, mode);
                cursors[name].want = want;
                return; // nothing new rendered
            }
            remaining = target - edge;
            setCursor(name, edgeEl, "off");
            cursors[name].want = want;
            const sc = scrollerOf(edgeEl);
            if (sc) sc.scrollTop += Math.sign(remaining) * sc.clientHeight * 0.5;
            await nextFrame();
            if (token !== moveToken) return;
            ensureVisible(cursorEl(name) || edgeEl, "off");
        }
    }

    // h / l: previous / next item in the same visual row (albums on home,
    // followers, artists...); like vim, it stops at the ends of the line
    function moveCol(n) {
        ++moveToken;
        const name = active;
        const items = getItems(name);
        if (!items.length) return;
        let cur = cursorEl(name);
        if (!items.includes(cur)) cur = firstVisible(items, name);
        const row = rowsOf(items).find((r) => r.includes(cur));
        const el = row[Math.max(0, Math.min(row.length - 1, row.indexOf(cur) + n))];
        const shelf = scrollerOfX(el);
        if (shelf) el.scrollIntoView({ block: "nearest", inline: "nearest" });
        setCursor(name, el, "off");
        cursors[name].want = centerX(el);
    }
    // horizontally scrolling shelf around an item, if any
    function scrollerOfX(el) {
        for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
            const ox = getComputedStyle(n).overflowX;
            if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 1) return n;
        }
        return null;
    }

    async function gotoEdge(dir) {
        const token = ++moveToken;
        const name = active;
        const sc = paneScroller(name);
        if (!sc) return;
        for (let i = 0; i < 20; i++) {
            const h = sc.scrollHeight;
            sc.scrollTop = dir > 0 ? sc.scrollHeight : 0;
            await nextFrame();
            if (token !== moveToken) return;
            if (dir < 0 || sc.scrollHeight === h) break;
        }
        // long lists (Liked Songs...) load lazily: when the grid knows its row
        // count, wait for the real last row to render before landing on it
        let items = getItems(name);
        const grid = items[0]?.closest('[role="grid"][aria-rowcount]');
        const lowest = () => Math.min(...items.map((it) => +it.getAttribute("aria-rowindex") || Infinity));
        for (let i = 0; grid && i < 120; i++) {
            const last = items[items.length - 1];
            if (dir > 0 && +last?.getAttribute("aria-rowindex") >= +grid.getAttribute("aria-rowcount")) break;
            if (dir < 0 && lowest() <= 2) break; // row 1 is the column header
            sc.scrollTop = dir > 0 ? sc.scrollHeight : 0;
            await new Promise((r) => setTimeout(r, 50));
            if (token !== moveToken) return;
            items = getItems(name);
        }
        if (items.length) setCursor(name, dir > 0 ? items[items.length - 1] : items[0], "off");
        else render();
    }

    // keep the cursor inside the visible window (vim does this after <C-e>, wheel, ...)
    function clampCursor(name) {
        const el = cursorEl(name);
        const sc = el && scrollerOf(el);
        if (!sc) return render();
        const v = view(sc);
        const r = el.getBoundingClientRect();
        const off = Math.min(CFG.scrolloff * r.height, Math.max(0, (v.height - r.height) / 2));
        if (r.top >= v.top + off - 1 && r.bottom <= v.bottom - off + 1) return render();
        const items = getItems(name).filter((it) => scrollerOf(it) === sc);
        const inside = items.filter((it) => {
            const b = it.getBoundingClientRect();
            return b.top >= v.top + off - 1 && b.bottom <= v.bottom - off + 1;
        });
        const pick = r.top < v.top ? inside[0] : inside[inside.length - 1];
        if (pick) setCursor(name, pick, "off", false);
        else render();
    }

    function activate(el) {
        if (!el) return;
        const track = el.querySelector(".main-trackList-trackListRow");
        if (track) {
            track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
            return;
        }
        // encore rows/cards put their click handler on an "<block>__on-click" overlay
        // (class prefix like e-10860 changes between Spotify versions)
        const target = el.querySelector(':scope > [data-testid="shortcut-background"]')
            ? el
            : el.querySelector('[class*="__on-click"]') || el.querySelector('a[href], [role="button"]') || el;
        target.click();
    }

    function uriOf(el) {
        const html = el.outerHTML;
        const m = html.match(/spotify:(track|album|playlist|artist|show|episode|user|collection)(:[A-Za-z0-9_]+)+/);
        if (m) return m[0];
        const a = el.querySelector('a[href*="/track/"], a[href*="/album/"], a[href*="/playlist/"], a[href*="/artist/"], a[href*="/show/"], a[href*="/episode/"]');
        if (a) return a.getAttribute("href");
        return null;
    }
    function toUrl(uriOrPath) {
        if (!uriOrPath) return null;
        if (uriOrPath.startsWith("spotify:")) {
            const parts = uriOrPath.split(":").slice(1);
            return "https://open.spotify.com/" + parts.join("/");
        }
        return "https://open.spotify.com" + new URL(uriOrPath, "https://open.spotify.com").pathname;
    }
    function copy(text) {
        const clip = S().Platform?.ClipboardAPI;
        return clip?.copy ? clip.copy(text) : navigator.clipboard?.writeText(text);
    }

    function setActive(name) {
        if (!visiblePanes().includes(name)) return;
        if (name !== active) leaveAll();
        active = name;
        for (const p of PANES) paneEl(p.name)?.toggleAttribute("data-tt-active", p.name === name);
        render();
    }
    let lastPane = "main";
    function cyclePane(dir) {
        const v = visiblePanes();
        const i = v.indexOf(active);
        setActive(v[(i + dir + v.length) % v.length]);
    }

    /* ================================
       UI: STATUSLINE, CMDLINE, NUMBERS, OVERLAYS
       ================================ */

    const status = document.createElement("div");
    status.id = "tt-status";
    const cmd = document.createElement("div");
    cmd.id = "tt-cmdline";
    const cmdPrompt = document.createElement("span");
    const cmdInput = document.createElement("input");
    cmdInput.spellcheck = false;
    cmdInput.autocomplete = "off";
    cmd.append(cmdPrompt, cmdInput);
    const overlay = document.createElement("div");
    overlay.id = "tt-overlay";
    document.body.append(status, cmd, overlay);

    let mode = "NORMAL";
    let showcmd = "";
    let msgTimer;

    function message(text, error = false) {
        if (mode === "COMMAND" || mode === "SEARCH") return;
        cmdPrompt.textContent = "";
        cmdInput.value = text;
        cmdInput.readOnly = true;
        cmd.toggleAttribute("data-error", error);
        cmd.setAttribute("data-open", "");
        clearTimeout(msgTimer);
        msgTimer = setTimeout(() => mode === "NORMAL" && cmd.removeAttribute("data-open"), 3000);
    }

    function position(name) {
        const el = cursorEl(name);
        const items = getItems(name);
        if (!el) return "";
        const ri = +el.getAttribute("aria-rowindex");
        const grid = el.closest('[role="grid"]');
        if (ri && grid?.getAttribute("aria-rowcount")) {
            const header = grid.querySelector('[role="columnheader"]') ? 1 : 0;
            return `${ri - header}/${+grid.getAttribute("aria-rowcount") - header}`;
        }
        return `${items.indexOf(el) + 1}/${items.length}`;
    }
    function percent(name) {
        const sc = paneScroller(name);
        if (!sc) return "All";
        const max = sc.scrollHeight - sc.clientHeight;
        if (max <= 0) return "All";
        if (sc.scrollTop <= 0) return "Top";
        if (sc.scrollTop >= max - 1) return "Bot";
        return Math.round((sc.scrollTop / max) * 100) + "%";
    }

    let rnuEls = [];
    function renderNumbers() {
        for (const el of rnuEls) el.removeAttribute("data-tt-rnu");
        rnuEls = [];
        if (!CFG.relativenumber) return;
        const cur = cursorEl(active);
        const rows = rowsOf(getItems(active));
        const ci = rows.findIndex((row) => row.includes(cur));
        if (ci < 0) return;
        const sc = scrollerOf(cur);
        const v = sc ? view(sc) : { top: 0, bottom: innerHeight };
        // numbers go in the gutter of list rows; shelves of cards would clip them
        rows.forEach((row, i) => {
            if (row.length > 1) return;
            const el = row[0];
            const r = el.getBoundingClientRect();
            if (r.bottom < v.top || r.top > v.bottom) return;
            const n = i === ci ? position(active).split("/")[0] : Math.abs(i - ci);
            el.setAttribute("data-tt-rnu", n);
            if (getComputedStyle(el).position === "static") el.style.position = "relative";
            rnuEls.push(el);
        });
    }

    function renderSlider() {
        document.querySelectorAll("[data-tt-slider]").forEach((n) => n.removeAttribute("data-tt-slider"));
        const sc = scope();
        const el = sc ? sc.sub : cursorEl(active);
        if (!el || !isSlider(el)) return;
        (el.closest("[data-testid]") || el.parentElement).setAttribute("data-tt-slider", sc?.adjust ? "grab" : "");
    }

    let raf = 0;
    function render() {
        if (raf || !alive()) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            renderNumbers();
            renderSlider();
            const label = mode === "INSERT" ? "-- INSERT --" : mode === "NORMAL" ? "NORMAL" : mode;
            status.innerHTML = "";
            for (const [cls, text] of [
                ["mode", label],
                ["showcmd", showcmd],
                ["pane", [active, ...scopes.map((sc, i) => (sc.layer ? (sc.el.matches('[role="menu"]') ? "menu" : "dialog") : sc.adjust ? "adjust" : labelOf(i === 0 ? sc.el : scopes[i - 1].sub))), labelOf(scope()?.sub)].filter(Boolean).join(" › ")],
                ["pos", position(active)],
                ["pct", percent(active)],
            ]) {
                if (!text) continue;
                const s = document.createElement("span");
                s.className = cls;
                s.textContent = text;
                status.append(s);
            }
            status.setAttribute("data-mode", mode.toLowerCase());
        });
    }

    /* ---------- cmdline (: and /) ---------- */

    let cmdHistory = [];
    let histIdx = 0;
    function openCmdline(prompt) {
        clearTimeout(msgTimer);
        mode = prompt === ":" ? "COMMAND" : "SEARCH";
        cmdPrompt.textContent = prompt;
        cmdInput.value = "";
        cmdInput.readOnly = false;
        cmd.removeAttribute("data-error");
        cmd.setAttribute("data-open", "");
        histIdx = cmdHistory.length;
        cmdInput.focus();
        render();
    }
    function closeCmdline() {
        cmd.removeAttribute("data-open");
        mode = "NORMAL";
        cmdInput.blur();
        render();
    }
    cmdInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        const k = e.key;
        if (k === "Escape" || (e.ctrlKey && (k === "c" || k === "["))) {
            e.preventDefault();
            closeCmdline();
        } else if (k === "Enter") {
            e.preventDefault();
            const text = cmdInput.value;
            const kind = cmdPrompt.textContent;
            closeCmdline();
            if (kind === ":") runCommand(text);
            else if (text) {
                lastSearch = text;
                searchNext(1);
            }
        } else if (k === "Backspace" && !cmdInput.value) {
            e.preventDefault();
            closeCmdline();
        } else if (cmdPrompt.textContent === ":" && (k === "ArrowUp" || k === "ArrowDown")) {
            e.preventDefault();
            histIdx = Math.max(0, Math.min(cmdHistory.length, histIdx + (k === "ArrowUp" ? -1 : 1)));
            cmdInput.value = cmdHistory[histIdx] ?? "";
        }
    });
    cmdInput.addEventListener("blur", () => (mode === "COMMAND" || mode === "SEARCH") && closeCmdline());

    let lastSearch = "";
    function searchNext(dir) {
        if (!lastSearch) return message("E35: No previous regular expression", true);
        const items = getItems(active);
        if (!items.length) return message(`E486: Pattern not found: ${lastSearch}`, true);
        const needle = lastSearch.toLowerCase();
        const start = Math.max(0, items.indexOf(cursorEl(active)));
        for (let k = 1; k <= items.length; k++) {
            const i = (start + dir * k + items.length * k) % items.length;
            if (items[i].innerText.toLowerCase().includes(needle)) {
                setCursor(active, items[i], "center"); // n/N are mapped with zz
                if ((dir > 0 && i <= start) || (dir < 0 && i >= start)) message(dir > 0 ? "search hit BOTTOM, continuing at TOP" : "search hit TOP, continuing at BOTTOM", true);
                else message((dir > 0 ? "/" : "?") + lastSearch);
                return;
            }
        }
        message(`E486: Pattern not found: ${lastSearch}`, true);
    }

    function parseTime(s) {
        const parts = s.split(":").map(Number);
        if (parts.some(isNaN)) return null;
        return parts.reduce((acc, p) => acc * 60 + p, 0) * 1000;
    }

    const COMMANDS = {
        "e|edit|find|s|search": (arg) => (arg ? History()?.push("/search/" + encodeURIComponent(arg)) : focusSearch()),
        "play|pause|toggle": () => Player()?.togglePlay(),
        "next|bn|cnext": () => Player()?.next(),
        "prev|previous|bp|cprev": () => Player()?.back(),
        "shuffle": () => Player()?.toggleShuffle(),
        "repeat": () => Player()?.toggleRepeat(),
        "like|heart": () => Player()?.toggleHeart(),
        "vol|volume": (arg) => {
            const v = Number(arg);
            if (isNaN(v)) return message(`volume ${Math.round((Player()?.getVolume?.() ?? 0) * 100)}`);
            Player()?.setVolume(Math.max(0, Math.min(100, v)) / 100);
        },
        "seek": (arg) => {
            const ms = parseTime(arg);
            if (ms == null) return message("E474: Invalid argument", true);
            Player()?.seek(ms);
        },
        "home": () => History()?.push("/"),
        "lib|library|Ex|Explore": () => setActive("library"),
        "back": () => History()?.goBack(),
        "forward": () => History()?.goForward(),
        "set|se": (arg) => setOption(arg),
        "h|help": () => toggleHelp(true),
        "noh|nohlsearch": () => (lastSearch = ""),
        "harpoon": () => harpoonMenu(),
    };
    function setOption(arg) {
        const m = arg.trim().match(/^(no)?(\w+)(?:=(\d+))?$/);
        if (!m) return message(`E518: Unknown option: ${arg}`, true);
        const [, no, opt, val] = m;
        if (opt === "rnu" || opt === "relativenumber") CFG.relativenumber = !no;
        else if (opt === "so" || opt === "scrolloff") CFG.scrolloff = Number(val ?? 0);
        else if (opt === "mousescroll") CFG.mousescroll = Math.max(1, Number(val ?? 1));
        else return message(`E518: Unknown option: ${opt}`, true);
        render();
    }
    function runCommand(text) {
        text = text.trim();
        if (!text) return;
        cmdHistory = cmdHistory.filter((h) => h !== text).concat(text);
        if (/^\d+$/.test(text)) return gotoLine(Number(text));
        const [, name, arg = ""] = text.match(/^(\S+)\s*(.*)$/);
        for (const [names, fn] of Object.entries(COMMANDS)) {
            if (names.split("|").includes(name)) return fn(arg.trim());
        }
        message(`E492: Not an editor command: ${text}`, true);
    }

    async function gotoLine(n) {
        await gotoEdge(-1);
        if (n > 1) move(n - 1);
    }

    // i: type into the current scope's text box (menu filter, dialog field,
    // Library search...), else the global search
    function insert() {
        const sc = validScope();
        const box = sc && (isEditable(sc.sub) ? sc.sub : controls(sc.el).find(isEditable));
        if (box) return box.focus();
        focusSearch();
    }

    function focusSearch() {
        const input = document.querySelector('.Root__globalNav input[type="search"], .Root__globalNav input, [data-testid="search-input"]');
        if (input) {
            input.focus();
            input.select?.();
        } else History()?.push("/search");
    }

    /* ---------- help ---------- */

    const HELP = [
        ["j / k", "down / up a row, keeps the column (5j)"],
        ["gg / G / :N", "first / last / Nth item"],
        ["<C-d> / <C-u>", "half page down / up, then zz"],
        ["<C-f> / <C-b>", "page down / up"],
        ["<C-y>", "scroll one line up (cursor stays)"],
        ["zz / zt / zb", "cursor line to center / top / bottom"],
        ["h / l", "left / right (cards in a row, controls in an item)"],
        ["H / L, <C-w>h/l/w", "focus pane left / right / next"],
        ["<C-w>j / <C-w>k", "down to the player bar / back up"],
        ["<CR> on a slider", "grab it: h / l seek 5s or volume 5% (6l), <Esc>"],
        ["<C-o> / <C-i>", "history back / forward (jumplist)"],
        ["<CR>", "go into the highlighted item; on a control: press it"],
        ["o", "play / open / press at any level"],
        ["K", "right-click menu of the highlighted thing (j k <CR> <Esc>)"],
        ["<Esc> / <BS>", "step back out one level"],
        ["/  n  N", "search visible items, next / prev (+zz)"],
        ["i / a", "type into the current box (menu filter, field) or search"],
        ["<Esc> / <C-c>", "leave insert mode / cancel"],
        [":", "command line (:help commands below)"],
        ["<leader>", "tap right ⌘ (then the key); Space = Spotify play/pause"],
        ["<leader><leader>", "play / pause (double-tap right ⌘)"],
        ["<leader>pv", "open Your Library pane"],
        ["<leader>h / l", "previous / next tab or filter of the pane"],
        ["<leader>1-9 / 0", "custom app N (marketplace, stats) / home"],
        ["<leader>[ / ]", "page back / forward"],
        ["<leader>y / Y", "yank link of item / current page"],
        ["<leader>a", "harpoon: mark current page"],
        ["<C-e>", "harpoon: quick menu (j k <CR> dd q)"],
        ["<C-h> <C-t> <C-n> <C-s>", "harpoon: jump to mark 1-4"],
        ["<C-k> / <C-j>", "next / previous track (cnext/cprev)"],
        ["wheel", "one line per notch, rows snap to grid"],
        [":e q  :next  :prev  :play", "search, playback"],
        [":vol N  :seek 1:23  :shuffle", "volume, seek, shuffle"],
        [":repeat  :like  :home  :lib", "repeat, heart, navigation"],
        [":set nornu  :set so=4", "options"],
    ];
    let overlayKind = null;
    function toggleHelp(force) {
        const open = force ?? overlayKind !== "help";
        if (!open) return closeOverlay();
        overlayKind = "help";
        overlay.innerHTML = "";
        const title = document.createElement("div");
        title.className = "tt-title";
        title.textContent = "text.txt — terminal keys          q to close";
        overlay.append(title);
        for (const [k, d] of HELP) {
            const row = document.createElement("div");
            row.className = "tt-row";
            const a = document.createElement("span");
            a.className = "tt-key";
            a.textContent = k;
            const b = document.createElement("span");
            b.textContent = d;
            row.append(a, b);
            overlay.append(row);
        }
        overlay.setAttribute("data-open", "");
    }
    function closeOverlay() {
        overlayKind = null;
        overlay.removeAttribute("data-open");
        overlay.innerHTML = "";
    }

    /* ---------- harpoon ---------- */

    const HARPOON_KEY = "text-theme:harpoon";
    const loadMarks = () => {
        try {
            return JSON.parse(localStorage.getItem(HARPOON_KEY)) || [];
        } catch {
            return [];
        }
    };
    const saveMarks = (m) => {
        try {
            localStorage.setItem(HARPOON_KEY, JSON.stringify(m));
        } catch {}
    };
    function currentPage() {
        const path = History()?.location?.pathname || location.pathname;
        const h = document.querySelector(".Root__main-view .main-entityHeader-title h1, .Root__main-view h1");
        return { path, title: (h?.textContent || document.title || path).trim().slice(0, 60) };
    }
    function harpoonAdd() {
        const page = currentPage();
        const marks = loadMarks().filter((m) => m.path !== page.path);
        marks.push(page);
        saveMarks(marks);
        message(`harpoon: ${marks.length} ${page.title}`);
    }
    function harpoonNav(i) {
        const m = loadMarks()[i];
        if (!m) return message(`harpoon: no mark ${i + 1}`, true);
        History()?.push(m.path);
    }
    let menuIdx = 0;
    let menuPending = "";
    function harpoonMenu(force) {
        if (overlayKind === "harpoon" && force !== true) return closeOverlay();
        overlayKind = "harpoon";
        const marks = loadMarks();
        menuIdx = Math.min(menuIdx, Math.max(0, marks.length - 1));
        overlay.innerHTML = "";
        const title = document.createElement("div");
        title.className = "tt-title";
        title.textContent = "Harpoon          j/k <CR> dd q";
        overlay.append(title);
        if (!marks.length) {
            const row = document.createElement("div");
            row.className = "tt-row";
            row.textContent = "(empty — <leader>a to mark a page)";
            overlay.append(row);
        }
        marks.forEach((m, i) => {
            const row = document.createElement("div");
            row.className = "tt-row";
            row.toggleAttribute("data-tt-cursor", i === menuIdx);
            row.textContent = `${i + 1}  ${m.title}  ${m.path}`;
            row.addEventListener("click", () => {
                closeOverlay();
                harpoonNav(i);
            });
            overlay.append(row);
        });
        overlay.setAttribute("data-open", "");
    }
    function harpoonMenuKey(tok) {
        const marks = loadMarks();
        if (menuPending === "d" && tok === "d") {
            marks.splice(menuIdx, 1);
            saveMarks(marks);
            menuPending = "";
            return harpoonMenu(true);
        }
        menuPending = tok === "d" ? "d" : "";
        if (tok === "j") menuIdx = Math.min(marks.length - 1, menuIdx + 1);
        else if (tok === "k") menuIdx = Math.max(0, menuIdx - 1);
        else if (tok === "<CR>") {
            closeOverlay();
            return harpoonNav(menuIdx);
        } else if (/^[1-9]$/.test(tok)) {
            closeOverlay();
            return harpoonNav(Number(tok) - 1);
        } else if (tok === "q" || tok === "<Esc>" || tok === "<C-e>" || tok === "<C-c>") return closeOverlay();
        if (overlayKind === "harpoon") harpoonMenu(true);
    }

    /* ================================
       SCOPES: pane > item > controls
       ================================ */

    // <CR> steps into the highlighted thing, <Esc> steps back out, and the same
    // hjkl move around whatever level you are on. Inside an item the targets
    // are its controls (buttons, links, inputs...), found generically so it
    // works for Spotify pages, Marketplace, Stats and dialogs alike.
    const CONTROL_SEL = [
        "a[href]",
        "button",
        "input",
        "select",
        "textarea",
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="switch"]',
        '[role="tab"]',
        '[role="slider"]',
        '[role="menuitem"]',
        '[role="option"]',
        '[tabindex="0"]',
    ].join(",");

    let scopes = []; // stack of { el, sub } below the pane-level cursor
    const scope = () => scopes[scopes.length - 1];

    function shown(el) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== "hidden" && cs.display !== "none";
    }
    function controls(container) {
        const box = container.getBoundingClientRect();
        const found = [...container.querySelectorAll(CONTROL_SEL)].filter((el) => {
            if (el.disabled || el.getAttribute("aria-disabled") === "true" || el.closest('[aria-hidden="true"]')) return false;
            if (el.type === "hidden" || !shown(el)) return false;
            const layer = el.closest(LAYER_SEL);
            if (layer && layer !== container && container.contains(layer)) return false; // belongs to a nested submenu
            const r = el.getBoundingClientRect();
            return !(r.width >= box.width * 0.9 && r.height >= box.height * 0.9); // whole-item click overlay = what o does
        });
        return found.filter((el) => !found.some((o) => o !== el && el.contains(o))); // innermost wins
    }

    // nearest target in a direction: distance along the axis + 2x the drift across it
    function spatial(from, targets, dir) {
        const a = from.getBoundingClientRect();
        const ax = a.left + a.width / 2;
        const ay = a.top + a.height / 2;
        let best = null;
        let bestScore = Infinity;
        for (const el of targets) {
            if (el === from) continue;
            const b = el.getBoundingClientRect();
            const dx = b.left + b.width / 2 - ax;
            const dy = b.top + b.height / 2 - ay;
            const along = { h: -dx, l: dx, k: -dy, j: dy }[dir];
            const across = dir === "h" || dir === "l" ? Math.abs(dy) : Math.abs(dx);
            if (along <= 2) continue;
            const score = along + across * 2;
            if (score < bestScore) {
                bestScore = score;
                best = el;
            }
        }
        return best;
    }

    const labelOf = (el) =>
        (el && isSlider(el) ? `${sliderName(el)} ${sliderValue(el)}` : null) ||
        (el?.getAttribute("aria-label") || el?.getAttribute("title") || el?.innerText || el?.value || "")
            .trim()
            .split("\n")[0]
            .slice(0, 28);

    function setSub(el) {
        const sc = scope();
        if (!sc) return;
        sc.sub?.removeAttribute("data-tt-sub");
        sc.sub = el;
        if (el) {
            el.setAttribute("data-tt-sub", "");
            // focus reveals hover-only controls (Spotify shows them on :focus-within);
            // not inside menus, where focus also pops submenus open
            if (!isEditable(el) && !el.closest(LAYER_SEL)) el.focus?.({ preventScroll: true });
            el.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        render();
    }
    function enter(el) {
        if (!el) return false;
        const cs = controls(el);
        if (!cs.length) return false;
        el.setAttribute("data-tt-scope", "");
        scopes.push({ el, sub: null });
        setSub(firstControl(cs));
        return true;
    }
    // reading order: leftmost control on the top visual line
    function firstControl(cs) {
        const rect = (c) => c.getBoundingClientRect();
        const top = cs.reduce((a, c) => (rect(c).top < rect(a).top ? c : a));
        const line = cs.filter((c) => rect(c).top < rect(top).bottom - 2);
        return line.reduce((a, c) => (rect(c).left < rect(a).left ? c : a));
    }
    // ...and the rightmost control on the bottom visual line
    function lastControl(cs) {
        const rect = (c) => c.getBoundingClientRect();
        const bottom = cs.reduce((a, c) => (rect(c).bottom > rect(a).bottom ? c : a));
        const line = cs.filter((c) => rect(c).bottom > rect(bottom).top + 2);
        return line.reduce((a, c) => (rect(c).right > rect(a).right ? c : a));
    }
    function leave() {
        const sc = scopes.pop();
        if (!sc) return false;
        sc.sub?.removeAttribute("data-tt-sub");
        sc.el.removeAttribute("data-tt-scope");
        if (document.activeElement && sc.el.contains(document.activeElement)) document.activeElement.blur();
        render();
        return true;
    }
    function leaveAll() {
        while (scopes.length) leave();
    }
    // drop scopes whose elements Spotify re-rendered away
    function validScope() {
        syncLayers();
        while (scopes.length && !scope().el.isConnected) leave();
        const sc = scope();
        if (sc && sc.sub && !sc.sub.isConnected) setSub(controls(sc.el)[0] || null);
        return scope();
    }

    /* ---------- layers: context menus, submenus, dialogs ---------- */

    const LAYER_SEL = '[role="menu"], [role="dialog"], [aria-modal="true"], .GenericModal';
    // the topmost open menu / dialog, if any (the last one in the DOM wins)
    function topLayer() {
        const open = [...document.querySelectorAll(LAYER_SEL)].filter((el) => el.id !== "tt-overlay" && shown(el) && controls(el).length);
        let layer = open.filter((el) => !el.parentElement?.closest(LAYER_SEL)).pop() || null;
        // descend into a submenu only after we opened it (<CR>/l on its item):
        // Spotify also expands submenus on mere focus/hover
        for (let sc; layer && (sc = scopes.find((x) => x.el === layer)) && sc.opened?.getAttribute("aria-expanded") === "true"; ) {
            const inner = open.find((el) => el !== layer && layer.contains(el) && el.parentElement.closest(LAYER_SEL) === layer);
            if (!inner) break;
            layer = inner;
        }
        return layer;
    }
    // a layer that opens takes over as the current scope; one that closes gives it back
    function syncLayers() {
        for (let i = scopes.length - 1; i >= 0; i--) {
            if (scopes[i].layer && !(scopes[i].el.isConnected && shown(scopes[i].el))) {
                scopes.splice(i).forEach((sc) => {
                    sc.sub?.removeAttribute("data-tt-sub");
                    sc.el.removeAttribute("data-tt-scope");
                });
            }
        }
        const layer = topLayer();
        if (layer && !scopes.some((sc) => sc.el === layer) && enter(layer)) {
            scope().layer = true;
            // menus/dialogs often autofocus a text box; stay in normal mode, i types into it
            if (isEditable(document.activeElement) && layer.contains(document.activeElement)) document.activeElement.blur();
        }
    }
    function closeLayer(el) {
        const outer = el.parentElement?.closest(LAYER_SEL);
        if (outer) {
            // a submenu closes when the pointer moves to another item of its menu
            const parent = scopes.find((sc) => sc.el === outer);
            const sibling = controls(outer).find((b) => !b.hasAttribute("aria-expanded"));
            if (parent) parent.opened = null;
            sibling?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
            sibling?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
            setTimeout(() => {
                syncLayers();
                render();
            }, 100);
            return;
        }
        const init = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true };
        (el.contains(document.activeElement) ? document.activeElement : el).dispatchEvent(new KeyboardEvent("keydown", init));
        setTimeout(() => {
            if (el.isConnected && shown(el) && el.matches('[role="menu"]')) {
                // context menus close on a mousedown outside them
                document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
            }
            syncLayers();
            render();
        }, 50);
    }

    // K: right-click the highlighted thing (vim's "tell me about the thing under the cursor")
    function contextMenu() {
        const target = validScope()?.sub || cursorEl();
        if (!target) return;
        const r = target.getBoundingClientRect();
        const x = r.left + Math.min(r.width / 2, 40);
        const y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        const el = hit && target.contains(hit) ? hit : target;
        el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 2, buttons: 2 }));
        setTimeout(() => {
            syncLayers();
            render();
        }, 150);
    }

    /* ---------- sliders: <CR> to grab, h/l to adjust, <Esc> to let go ---------- */

    const isSlider = (el) => !!el && (el.matches('input[type="range"], [role="slider"]') || !!el.querySelector?.(':scope > input[type="range"]'));
    const sliderInput = (el) => (el.matches('input[type="range"]') ? el : el.querySelector('input[type="range"]'));
    function sliderName(el) {
        const id = el.closest("[data-testid]")?.dataset.testid || "";
        if (/progress/.test(id)) return "seek";
        if (/volume/.test(id)) return "volume";
        return labelOf(el) || "slider";
    }
    function enterAdjust(el) {
        el.setAttribute("data-tt-scope", "");
        el.setAttribute("data-tt-sub", "");
        scopes.push({ el, sub: el, adjust: true });
        render();
    }
    function adjust(el, n) {
        const kind = sliderName(el);
        const P = Player();
        if (kind === "seek" && P?.seek) P.seek(Math.max(0, (P.getProgress?.() ?? 0) + n * 5000));
        else if (kind === "volume" && P?.setVolume) P.setVolume(Math.max(0, Math.min(1, (P.getVolume?.() ?? 0) + n * 0.05)));
        else {
            const input = sliderInput(el);
            if (!input) return;
            const step = Number(input.step) || (Number(input.max) - Number(input.min)) / 20 || 1;
            const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
            set.call(input, Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value) + n * step)));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        setTimeout(render, 100);
    }
    function sliderValue(el) {
        const input = sliderInput(el);
        if (!input) return "";
        const kind = sliderName(el);
        const P = Player();
        // the range input lags behind the player by a render; ask the player
        if (kind === "volume") return Math.round((P?.getVolume?.() ?? Number(input.value)) * 100) + "%";
        if (kind === "seek") {
            const sec = Math.round((P?.getProgress?.() ?? Number(input.value)) / 1000);
            return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
        }
        return input.value;
    }

    function pressControl(el) {
        if (!el) return;
        if (isEditable(el)) return el.focus();
        const sc = scope();
        if (sc?.layer) sc.opened = el; // lets topLayer() follow into its submenu
        if (sc?.layer && el.hasAttribute("aria-expanded")) {
            // Spotify submenus open on hover, not on click
            el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
            el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
            el.dispatchEvent(new MouseEvent("mouseenter"));
        } else el.click();
        // the click may have opened a submenu, closed a menu, re-rendered or navigated
        setTimeout(() => {
            syncLayers();
            validScope();
            render();
        }, 150);
    }

    // the generic actions every level shares
    const act = {
        nav(dir, n) {
            const sc = validScope();
            if (sc?.adjust) return dir === "h" || dir === "l" ? adjust(sc.el, dir === "l" ? n : -n) : undefined;
            if (!sc) {
                const items = getItems(active);
                if (items.generic && items.length) {
                    let el = items.includes(cursorEl()) ? cursorEl() : firstControl(items);
                    if (el === cursorEl()) for (let i = 0; i < n; i++) el = spatial(el, items, dir) || el;
                    return setCursor(active, el, "off");
                }
                return dir === "j" ? move(n) : dir === "k" ? move(-n) : moveCol(dir === "l" ? n : -n);
            }
            const targets = controls(sc.el);
            let el = sc.sub && targets.includes(sc.sub) ? sc.sub : targets[0];
            // in menus, l at the right edge opens the submenu, h at the left edge closes it
            if (sc.layer && !spatial(el, targets, dir)) {
                if (dir === "l") return pressControl(el);
                if (dir === "h" && scopes.filter((x) => x.layer).length > 1) return act.back();
            }
            for (let i = 0; i < n; i++) el = spatial(el, targets, dir) || el;
            setSub(el);
        },
        edge(dir) {
            const sc = validScope();
            if (!sc) return gotoEdge(dir);
            const targets = controls(sc.el);
            if (!targets.length) return;
            setSub(dir < 0 ? firstControl(targets) : lastControl(targets));
        },
        // <CR>: go inside if there is anything inside, otherwise press it
        enter() {
            const sc = validScope();
            if (!sc && isSlider(cursorEl())) return enterAdjust(cursorEl());
            if (sc && !sc.adjust && isSlider(sc.sub)) return enterAdjust(sc.sub);
            if (sc?.adjust) return leave();
            if (!sc) return enter(cursorEl()) || activate(cursorEl());
            if (sc.sub && controls(sc.sub).length > 1) return enter(sc.sub);
            pressControl(sc.sub);
        },
        // o: press the highlighted thing at whatever level we are
        open() {
            const sc = validScope();
            if (!sc) return activate(cursorEl());
            pressControl(sc.sub);
        },
        back() {
            if (overlayKind) return closeOverlay();
            syncLayers();
            if (scope()?.layer) return closeLayer(scope().el);
            leave();
        },
    };

    /* ================================
       KEYMAPS
       ================================ */

    // the tab group of the focused pane: Spotify filter chips (All / Music /
    // Podcasts, Your Library filters, search filters), role=tab strips, or
    // custom-app tab bars (Marketplace: Extensions / Themes / ...). Wraps like gt/gT.
    function tabGroup(root) {
        const visible = (els) => [...els].filter((e) => e.offsetWidth && !e.closest('[aria-hidden="true"]'));
        let chips = visible(root.querySelectorAll('[data-encore-id="chip"]'));
        if (chips.length) {
            // selecting Music/Podcasts inserts sub-filters ("Following") in a differently
            // classed wrapper; only cycle the top-level ones, which share the first one's
            const base = chips[0].parentElement.className;
            return chips.filter((c) => c.parentElement.className === base);
        }
        const tabs = visible(root.querySelectorAll('[role="tab"]'));
        if (tabs.length) return tabs;
        const bar = root.querySelector('[role="tablist"], [class*="tabBar" i], [class*="tab-bar" i], [class*="tabs" i]');
        return bar ? visible(bar.querySelectorAll("a, button")) : [];
    }
    const isOn = (c) =>
        ["aria-checked", "aria-pressed", "aria-selected"].some((a) => c.getAttribute(a) === "true") ||
        /(^|[-_\s])(active|selected)\b/i.test(c.className + " " + (c.parentElement?.className || ""));
    // filter bars with no "All" chip (Your Library) hide the other filters and
    // show sub-filters once one is picked; remember the top level while nothing
    // is selected and cycle "none -> Playlists -> Podcasts -> ... -> none"
    const topFilters = {};
    async function chip(dir) {
        const root = tabGroup(paneEl(active)).length ? paneEl(active) : paneEl("main");
        const pane = paneOf(root) || "main";
        let group = tabGroup(root);
        if (!group.length) return message("no tabs or filters here", true);
        const text = (c) => c.innerText.trim();
        if (!group.some(isOn) && group[0].dataset.encoreId === "chip") topFilters[pane] = group.map(text);
        const tops = topFilters[pane];
        if (!tops) {
            const i = group.findIndex(isOn);
            group[(i < 0 ? (dir > 0 ? 0 : group.length - 1) : i + dir + group.length) % group.length].click();
        } else {
            const slots = [null, ...tops];
            const on = group.find((c) => isOn(c) && tops.includes(text(c)));
            const target = slots[(slots.indexOf(on ? text(on) : null) + dir + slots.length) % slots.length];
            if (on) on.click(); // deselect: the other top-level filters come back
            for (let i = 0; target && i < 20; i++) {
                const el = tabGroup(root).find((c) => text(c) === target);
                if (el) {
                    el.click();
                    break;
                }
                await new Promise((r) => setTimeout(r, 50));
            }
            message(`filter: ${target ?? "none"}`);
        }
        cursors[pane] = {};
        setTimeout(render, 300);
    }

    // custom apps in the order of config-xpui.ini (custom_apps = marketplace|stats)
    function customApp(n) {
        let apps = S().Config?.custom_apps;
        if (typeof apps === "string") apps = apps.split("|");
        apps = (apps || []).filter(Boolean);
        if (apps[n - 1]) return History()?.push("/" + apps[n - 1]);
        // fallback: the app buttons between "Go forward" and "Home" in the nav bar
        const btns = [...document.querySelectorAll(".Root__globalNav button")].filter((b) => b.offsetWidth);
        const labels = btns.map((b) => b.getAttribute("aria-label") || "");
        const from = labels.indexOf("Go forward") + 1;
        const to = labels.indexOf("Home");
        const navApps = btns.slice(from, to < 0 ? btns.length : to).filter((b) => !/update/i.test(b.getAttribute("aria-label") || ""));
        if (navApps[n - 1]) return navApps[n - 1].click();
        message(`no app ${n}`, true);
    }

    const L = CFG.leader;
    const halfPage = (dir) => {
        const el = cursorEl() || getItems(active)[0];
        const sc = el ? scrollerOf(el) : paneScroller(active);
        if (!sc) return;
        if (!el) return (sc.scrollTop += (dir * sc.clientHeight) / 2);
        move(dir * Math.max(1, Math.floor(view(sc).height / el.offsetHeight / 2)), "center");
    };
    const fullPage = (dir) => {
        const el = cursorEl() || getItems(active)[0];
        const sc = el ? scrollerOf(el) : paneScroller(active);
        if (!sc) return;
        if (!el) return (sc.scrollTop += dir * (sc.clientHeight - 2 * textLine()));
        move(dir * Math.max(1, Math.floor(view(sc).height / el.offsetHeight) - 2), dir > 0 ? "top" : "bottom");
    };
    const z = (where) => () => {
        const el = cursorEl();
        if (el) ensureVisible(el, where);
        render();
    };
    const yank = (page) => () => {
        const url = page ? toUrl(currentPage().path) : toUrl(uriOf(cursorEl() || document.body));
        if (!url) return message("E353: Nothing to yank", true);
        copy(url);
        message(`yanked ${url}`);
    };

    const MAPS = {
        j: (c) => act.nav("j", c),
        k: (c) => act.nav("k", c),
        h: (c) => act.nav("h", c),
        l: (c) => act.nav("l", c),
        gg: (c, counted) => (counted && !scope() ? gotoLine(c) : act.edge(-1)),
        G: (c, counted) => (counted && !scope() ? gotoLine(c) : act.edge(1)),
        "<C-d>": () => halfPage(1),
        "<C-u>": () => halfPage(-1),
        "<C-f>": () => fullPage(1),
        "<C-b>": () => fullPage(-1),
        "<C-y>": (c) => {
            scrollLines(cursorEl() ? scrollerOf(cursorEl()) : paneScroller(active), -c);
            clampCursor(active);
        },
        zz: z("center"),
        "z.": z("center"),
        zt: z("top"),
        "z<CR>": z("top"),
        zb: z("bottom"),
        "z-": z("bottom"),
        H: () => cyclePane(-1),
        L: () => cyclePane(1),
        "<C-w>h": () => cyclePane(-1),
        "<C-w>l": () => cyclePane(1),
        "<C-w>j": () => {
            if (active !== "player") lastPane = active;
            setActive("player");
        },
        "<C-w>k": () => setActive(active === "player" ? lastPane : active),
        "<C-w>w": () => cyclePane(1),
        "<C-w><C-w>": () => cyclePane(1),
        "<C-o>": () => History()?.goBack(), // jumplist older
        "<C-i>": () => History()?.goForward(), // jumplist newer
        "<CR>": () => act.enter(),
        K: () => contextMenu(),
        o: () => act.open(),
        i: () => insert(),
        a: () => insert(),
        "/": () => openCmdline("/"),
        n: () => searchNext(1),
        N: () => searchNext(-1),
        ":": () => openCmdline(":"),
        "?": () => toggleHelp(),
        [L + L]: () => Player()?.togglePlay(), // double-tap right ⌘ (plain <Space> also works: Spotify's own)
        [L + "pv"]: () => setActive("library"),
        [L + "h"]: () => chip(-1),
        [L + "l"]: () => chip(1),
        [L + "0"]: () => History()?.push("/"),
        ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [L + n, () => customApp(n)])),
        [L + "["]: () => History()?.goBack(),
        [L + "]"]: () => History()?.goForward(),
        [L + "y"]: yank(false),
        [L + "Y"]: yank(true),
        [L + "a"]: () => harpoonAdd(),
        "<C-e>": () => harpoonMenu(),
        "<C-h>": () => harpoonNav(0),
        "<C-t>": () => harpoonNav(1),
        "<C-n>": () => harpoonNav(2),
        "<C-s>": () => harpoonNav(3),
        "<C-k>": () => Player()?.next(),
        "<C-j>": () => Player()?.back(),
        Q: () => {},
        "<Esc>": () => act.back(),
        "<BS>": () => act.back(),
        "<C-c>": () => act.back(),
    };
    const MAP_KEYS = Object.keys(MAPS);

    function token(e) {
        const named = { Enter: "<CR>", Escape: "<Esc>", Tab: "<Tab>", Backspace: "<BS>" };
        let k = named[e.key] || e.key;
        if (e.key.length > 1 && !named[e.key]) return null; // arrows, F-keys, modifiers: leave to Spotify
        if (e.ctrlKey) k = `<C-${k.toLowerCase()}>`;
        return k;
    }

    function isEditable(el) {
        if (!el || el === cmdInput) return false;
        if (el.isContentEditable) return true;
        if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
        return el.tagName === "INPUT" && !["range", "checkbox", "radio", "button", "submit"].includes(el.type);
    }

    let seq = "";
    let count = "";
    let timer;
    function reset() {
        seq = "";
        count = "";
        showcmd = "";
        clearTimeout(timer);
        render();
    }
    function run(keys, table = MAPS) {
        const counted = count !== "";
        const c = counted ? Math.max(1, parseInt(count, 10)) : 1;
        reset();
        try {
            const r = table[keys](c, counted);
            if (r && typeof r.catch === "function") r.catch((err) => message(String(err?.message || err), true));
        } catch (err) {
            console.error("[text] mapping failed", keys, err);
        }
    }

    // <Esc>/<C-c>/<C-[> in a text field. Spotify's search dropdown ignores Escape
    // and blur; it only closes on a mousedown outside it, so leaving insert mode
    // does what clicking away does
    function leaveInsert(e) {
        const field = document.activeElement;
        if (field.closest('[role="menu"]')) {
            // inside a menu, Escape would close the whole menu: just leave the box
            e.preventDefault();
            e.stopImmediatePropagation();
            field.blur();
            mode = "NORMAL";
            return render();
        }
        if (e.key !== "Escape") {
            e.preventDefault();
            e.stopImmediatePropagation();
            const init = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true, composed: true };
            field.dispatchEvent(new KeyboardEvent("keydown", init));
            field.dispatchEvent(new KeyboardEvent("keyup", init));
        }
        setTimeout(() => {
            if (document.activeElement === field) field.blur();
            // (not inside a dialog: an outside click would close it and lose the edits)
            if (!field.closest(LAYER_SEL)) for (const type of ["mousedown", "mouseup"]) document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            mode = "NORMAL";
            render();
        });
    }

    // right ⌘ is the leader: a tap (press + release, nothing else) feeds
    // <leader>; holding it while pressing a key works too, unless macOS or
    // Spotify's native menu claims that ⌘-shortcut first. Left ⌘ is untouched.
    let rightCmd = false;
    let rightCmdUsed = false;

    function onKey(e) {
        if (!alive() || e.isComposing) return;
        if (e.code === "MetaRight") {
            rightCmd = true;
            rightCmdUsed = false;
            return;
        }
        if (e.target === cmdInput) return;
        const leaderChord = rightCmd && e.metaKey && !e.altKey;
        if (leaderChord) rightCmdUsed = true;
        if ((e.metaKey && !leaderChord) || e.altKey) return;

        if (isEditable(document.activeElement)) {
            if (mode !== "INSERT") {
                mode = "INSERT";
                render();
            }
            if (e.key === "Escape" || (e.ctrlKey && (e.key === "c" || e.key === "["))) leaveInsert(e);
            return;
        }
        if (mode === "INSERT") mode = "NORMAL";

        const tok = token(e);
        if (!tok) return;
        if (leaderChord && !seq) feed(L, null);
        feed(tok, e);
    }

    function onKeyUp(e) {
        if (!alive() || e.code !== "MetaRight") return;
        const tapped = rightCmd && !rightCmdUsed;
        rightCmd = false;
        if (!tapped || e.target === cmdInput || isEditable(document.activeElement)) return;
        if (mode === "INSERT") mode = "NORMAL";
        feed(L, null);
    }

    // run one key through the mapping machine (counts, pending sequences, overlays)
    function feed(tok, e) {
        const swallow = () => {
            if (!e) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        };

        if (overlayKind === "harpoon") {
            swallow();
            return harpoonMenuKey(tok);
        }
        if (overlayKind === "help" && (tok === "q" || tok === "<Esc>" || tok === "?" || tok === "<C-c>")) {
            swallow();
            return closeOverlay();
        }

        if (!seq && /^[0-9]$/.test(tok) && (tok !== "0" || count)) {
            count += tok;
            showcmd = count;
            swallow();
            clearTimeout(timer);
            timer = setTimeout(reset, CFG.timeoutlen * 3);
            return render();
        }

        const next = seq + tok;
        const table = MAPS;
        const exact = table[next] !== undefined;
        const longer = Object.keys(table).some((k) => k.length > next.length && k.startsWith(next));

        if (!exact && !longer) {
            const hadPending = seq || count;
            reset();
            if (hadPending) swallow();
            return; // unmapped: let Spotify have it
        }

        swallow();
        clearTimeout(timer);
        if (exact && !longer) return run(next, table);

        seq = next;
        showcmd = count + seq;
        render();
        timer = setTimeout(() => (table[seq] ? run(seq, table) : reset()), CFG.timeoutlen);
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    // swallow the keypress/keyup that belong to a key we consumed
    for (const type of ["keypress", "keyup"]) {
        window.addEventListener(
            type,
            (e) => {
                if (!alive() || e.metaKey || e.altKey || e.target === cmdInput || isEditable(document.activeElement)) return;
                if ((seq || count) && token(e)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            },
            true
        );
    }
    // ⌘ released while the window was in the background: don't leave it "held"
    window.addEventListener("blur", () => (rightCmd = false));

    /* ================================
       DISCRETE WHEEL
       ================================ */

    function wheelScroller(node, dir) {
        for (let n = node; n && n !== document.documentElement; n = n.parentElement) {
            if (n.nodeType !== 1 || !isScrollable(n)) continue;
            if (dir > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return n;
        }
        return null;
    }

    let acc = 0;
    let lastWheel = 0;
    window.addEventListener(
        "wheel",
        (e) => {
            if (!alive() || e.ctrlKey || e.defaultPrevented) return;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // horizontal shelves stay native
            if (e.target.closest?.('input[type="range"], [data-tt-native-wheel]')) return;
            const dir = Math.sign(e.deltaY);
            if (!dir) return;
            const sc = wheelScroller(e.target, dir);
            if (!sc) return;
            e.preventDefault();

            let lines;
            if (e.deltaMode === 1) lines = Math.trunc(e.deltaY) || dir;
            else if (e.deltaMode === 2) lines = dir * Math.max(1, Math.floor(sc.clientHeight / lineStep(sc).step) - 2);
            else {
                const now = performance.now();
                // a fresh gesture (mouse notch or first trackpad movement) always moves a line
                if (now - lastWheel > 150 || Math.sign(acc) !== dir) acc = dir * CFG.pixelsPerLine;
                else acc += e.deltaY;
                lastWheel = now;
                lines = Math.trunc(acc / CFG.pixelsPerLine);
                acc -= lines * CFG.pixelsPerLine;
            }
            if (!lines) return;
            scrollLines(sc, lines * CFG.mousescroll);
            const pane = paneOf(sc);
            if (pane) clampCursor(pane);
        },
        { passive: false, capture: true }
    );

    /* ================================
       SYNC WITH THE APP
       ================================ */

    // clicking an item moves the cursor there (like :set mouse=a)
    document.addEventListener(
        "mousedown",
        (e) => {
            const pane = alive() && paneOf(e.target);
            if (!pane) return;
            if (pane !== active) setActive(pane);
            const item = e.target.closest(ITEM_SEL);
            const items = getItems(pane);
            const hit = items.includes(item) ? item : items.find((it) => it.contains(e.target));
            if (hit) setCursor(pane, hit, "off", false);
        },
        true
    );
    document.addEventListener("scroll", () => render(), { capture: true, passive: true });
    document.addEventListener("focusin", () => {
        if (isEditable(document.activeElement) && mode === "NORMAL") {
            mode = "INSERT";
            render();
        }
    });
    document.addEventListener("focusout", () =>
        setTimeout(() => {
            if (mode === "INSERT" && !isEditable(document.activeElement)) {
                mode = "NORMAL";
                render();
            }
        })
    );
    try {
        History()?.listen?.(() => {
            if (active === "main") leaveAll();
            cursors.main = {};
            setTimeout(render, 300);
        });
    } catch {}

    setActive("main");
    window.__textTerminalApi = { move, setActive, cursorEl, getItems, runCommand, CFG, controls, topLayer, get scopes() { return scopes; } };
})();
