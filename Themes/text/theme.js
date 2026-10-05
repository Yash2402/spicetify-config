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

    const CFG = {
        mousescroll: 1, // lines per wheel notch
        pixelsPerLine: 40, // trackpad travel that counts as one notch
    };

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
       LINES
       ================================ */

    const textLine = () => parseFloat(getComputedStyle(document.body).lineHeight) || 17;

    function isScrollable(n) {
        const oy = getComputedStyle(n).overflowY;
        return (oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight > n.clientHeight + 1;
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
        },
        { passive: false, capture: true }
    );
})();
