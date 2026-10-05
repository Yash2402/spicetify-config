#!/bin/sh
# Restart Spotify with (or without) the Chromium remote-debugging port,
# keeping the current track, position and play/pause state.
#
#   tools/spotify-debug.sh        # on:  restart with --remote-debugging-port
#   tools/spotify-debug.sh off    # off: restart normally (closes the port)
#
# While the port is open any program on this Mac can control Spotify and read
# its session, so turn it off when you are done.

PORT="${SPOTIFY_DEBUG_PORT:-9222}"
MODE="${1:-on}"

case "$MODE" in
on | off) ;;
*)
    echo "usage: $0 [on|off]" >&2
    exit 2
    ;;
esac

state=""
if pgrep -x Spotify >/dev/null; then
    state=$(osascript -e 'tell application "Spotify" to return (id of current track) & "|" & (player position) & "|" & (player state as string)' 2>/dev/null)
    osascript -e 'tell application "Spotify" to quit'
    i=0
    while pgrep -x Spotify >/dev/null && [ $i -lt 40 ]; do
        sleep 0.25
        i=$((i + 1))
    done
fi

if [ "$MODE" = on ]; then
    open -a Spotify --args --remote-debugging-port="$PORT"
    i=0
    until curl -s "http://localhost:$PORT/json" | grep -q xpui; do
        sleep 0.5
        i=$((i + 1))
        if [ $i -gt 60 ]; then
            echo "Spotify did not open the debugging port $PORT" >&2
            exit 1
        fi
    done
else
    open -a Spotify
fi
sleep 4 # let the player come up before restoring it

track=$(echo "$state" | cut -d'|' -f1)
position=$(echo "$state" | cut -d'|' -f2)
playing=$(echo "$state" | cut -d'|' -f3)
if [ "$playing" = playing ] && [ -n "$track" ]; then
    osascript -e "tell application \"Spotify\" to play track \"$track\"" \
        -e "tell application \"Spotify\" to set player position to $position" >/dev/null
fi

if [ "$MODE" = on ]; then
    echo "Spotify is running with the debugging port on localhost:$PORT"
    echo "run 'node tools/dev.mjs' to live-reload the theme; 'tools/spotify-debug.sh off' when done"
else
    if curl -s -m 2 "http://localhost:$PORT/json" >/dev/null; then
        echo "warning: port $PORT still answers" >&2
    else
        echo "Spotify restarted normally (debugging port closed)"
    fi
fi
