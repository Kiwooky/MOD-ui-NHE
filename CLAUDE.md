# Working on mod-ui-nhe (for Claude Code and other agents)

Read README.md first, then HANDOVER.md for current status and the next task. This repo extends MOD's web UI **without changing MOD's code**.

## Rules

1. **Never edit MOD's files.** Everything lives under `nhe/`. On the device the only hooks are the link and the one script tag that `nhe/device/install.sh` manages.
2. **Only `nhe/adapter/mod.js` touches MOD internals** (globals like `desktop`, `$.fn.pedalboard`, `WINDOWMANAGER`, element ids, private methods). Features call `NHE.mod.*`. If a feature needs something new from MOD, add it to the adapter with a comment saying what it depends on.
3. **No build step.** Plain browser JavaScript, loaded as-is. Keep to ES5 where practical; never go above what MOD 1.14 itself needs (ES2020, iOS 13.4+).
4. **A new feature** = a folder in `nhe/features/<id>/` with an `index.js` that calls `NHE.register('<id>', function (mod) { ... })`, plus an entry in `FEATURES` in `nhe/loader.js`. It can be switched off with the preference `nhe-<id>` = `"false"`.
5. **`features/performance/performance.js` and `.css` are shared** with the `performance-view` branch of github.com/Kiwooky/mod-ui (`html/js/performance.js`, `html/css/performance.css`). Develop here; copy across to the branch when preparing an upstream pull request (keep that file's 2-line header, and its CSS uses `../img/` where this one uses `/img/`).
6. **Device actions need the user's OK.** `tools/deploy.sh` and anything over ssh change the user's MOD. Ask before running them.

## Dev loop

- The user runs MOD Desktop (serves MOD's UI on 127.0.0.1:18181) and `npm run dev` (proxy on http://localhost:18080). Or `npm run dev:duo` for the Duo at 192.168.51.1.
- Edit files under `nhe/`, then reload http://localhost:18080. `/nhe/*` is served from disk with no caching; `version.json` is generated from file times.
- Check your work in the browser (Claude in Chrome or Playwright): screenshot the page, read the console (`[nhe]` lines show which features started), exercise the feature. Set `window.PERFORMANCE_VIEW_DEBUG = true` in the console to trace the performance view.
- MOD Desktop hides File Manager, Banks, Plugin Store, Settings and hardware addressing. Test those against the Duo.

## MOD facts that cost time before

- **Duo layout:** web UI in `/usr/share/mod/html/` (root filesystem read-only; `mount -o remount,rw /` then back to `ro`); backend in `/usr/lib/python3.4/site-packages/mod/`; `/data` is writable and persistent. ssh/scp as `root`, password `mod`.
- **macOS `scp` needs `-O`:** the MOD has no SFTP subsystem ("subsystem request failed on channel 0").
- **Run device commands on the device.** Several mistakes came from pasting device commands into the Mac's terminal.
- **Caching:** mod-ui serves static files with `Cache-Control: max-age=31536000`, so the loader fetches `version.json` fresh and versions every other URL with it. `deploy.sh` writes a new version each time. mod-ui reads files and `index.html` (a Tornado template) from disk on every request: no restart or reboot is needed after changing them.
- **Symlinks:** mod-ui's static handler follows the `html/nhe → /data/nhe` link (verified with mod-ui's own server, tornado 4.3).
- **Websocket through a proxy:** mod-ui refuses a websocket whose `Origin` isn't its own host; `devproxy.js` rewrites `Host` and `Origin`.
- **Plugins arrive one by one** over the websocket when a pedalboard loads, in no particular order, and the bundle name can update before or after them. Don't pick "the first plugin" until the board settles (see `settling` in performance.js).
- **jquery.ba-resize** (used elsewhere in MOD's UI) fires `resize` on elements and those bubble to `window`. Only react to real window resizes (`e.target === window`), or you re-lay out ~16 times a second.
- **iOS < 13.4 can't run MOD 1.14 at all** (optional chaining in modgui.js/pedalboard.js). Old iPads are out.
- **One MOD tab at a time:** mod-ui expects one browser client. A second tab (via the proxy or direct) can hang on "Loading pedalboard…".

## Tests

`test/` holds the Playwright suites written for the performance view (34 + 20 checks plus touch). They were built against mod-ui in dev mode with MOD's plugin data (guitarix plugins), not MOD Desktop's plugin set; see test/README.md. Run them after changing the performance view or the adapter.
