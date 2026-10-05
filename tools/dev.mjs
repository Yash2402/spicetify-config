// Live-reload the text theme into a running Spotify, without reloading the page.
//
//   tools/spotify-debug.sh     # once: restart Spotify with the debugging port
//   node tools/dev.mjs         # watch theme.js + user.css, inject on every save
//
// theme.js is re-run in the page; the previous copy retires itself (see the
// __textTerminalId guard at the top of theme.js). The part of user.css after
// the "TERMINAL BEHAVIOUR (theme.js)" marker is swapped in a <style> tag.
// Changes above that marker or in color.ini need `spicetify apply`.
// When you are happy: `spicetify apply` to install, then
// `tools/spotify-debug.sh off`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THEME = path.join(ROOT, "Themes", "text");
const PORT = process.env.SPOTIFY_DEBUG_PORT || 9222;
const MARKER = "TERMINAL BEHAVIOUR (theme.js)";

async function spotifyPage() {
    let pages;
    try {
        pages = await (await fetch(`http://localhost:${PORT}/json`)).json();
    } catch {
        throw new Error(`Spotify isn't reachable on port ${PORT}; run tools/spotify-debug.sh first`);
    }
    const page = pages.find((p) => p.type === "page" && p.url.includes("xpui"));
    if (!page) throw new Error("Spotify's main page isn't loaded yet");
    return page.webSocketDebuggerUrl;
}

function evaluate(wsUrl, expression) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        ws.onerror = () => reject(new Error("couldn't connect to Spotify"));
        ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.id !== 1) return;
            ws.close();
            const err = msg.result?.exceptionDetails;
            if (err) reject(new Error(err.exception?.description || err.text));
            else resolve(msg.result?.result?.value);
        };
    });
}

async function inject() {
    const css = fs.readFileSync(path.join(THEME, "user.css"), "utf8");
    const js = fs.readFileSync(path.join(THEME, "theme.js"), "utf8");
    const tail = css.includes(MARKER) ? "/*" + css.split(MARKER)[1] : "";
    const setup = `(() => {
        const s = document.getElementById("tt-dev-css") || document.head.appendChild(Object.assign(document.createElement("style"), { id: "tt-dev-css" }));
        s.textContent = ${JSON.stringify(tail)};
        window.__textTerminal = false; // let the new copy of theme.js start
    })();`;
    await evaluate(await spotifyPage(), `${setup}\n${js}\n;window.__textTerminalId`);
}

const stamp = () => new Date().toLocaleTimeString();
async function reload(reason) {
    try {
        await inject();
        console.log(`${stamp()}  injected (${reason})`);
    } catch (e) {
        console.error(`${stamp()}  ${e.message}`);
    }
}

let timer;
for (const file of ["theme.js", "user.css"]) {
    fs.watch(path.join(THEME, file), () => {
        clearTimeout(timer);
        timer = setTimeout(() => reload(file), 150); // editors write in bursts
    });
}
console.log(`watching ${path.relative(ROOT, THEME)}/{theme.js,user.css} — Ctrl+C to stop`);
reload("start");
