// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE's connection screen, in place of MOD's "Disconnected / Reload" blocker
 * (desktop.blockUI): large enough to read and hit on a tablet or a phone,
 * and it reconnects on its own.
 *
 *   - Connection lost: asks the MOD's web server every 2 s (every 5 s after
 *     a while), and at once when the page comes back into view, the network
 *     returns or the window gets focus (a tablet waking up, a Mac waking from
 *     sleep). As soon as the server answers, the page reloads.
 *   - Updating (MOD's auto-update): waits until the MOD has gone away and
 *     come back (it restarts), then reloads.
 *   - Reload now, at any time: a tap is enough (pointerup as well as click:
 *     MOD's page swallows some touches).
 *   - No reload loop: if the server answers but 3 reloads in 2 minutes
 *     didn't reconnect (MOD wants one browser at a time: another tab?), it
 *     stops and says so, Reload now still there.
 *
 * Starts early (loader.js): the connection can drop before MOD's pedalboard
 * ever loads, and boot.css may still be hiding MOD's page; this screen shows
 * regardless. Try it: desktop.blockUI() in the console closes MOD's
 * websocket (the page reloads once the server answers); stop MOD Desktop for
 * the "can't reach" state.
 */
NHE.register('connection', function (mod) {
    var FAST = 2000, SLOW = 5000, PATIENT = 10      // every 2 s, then every 5 s after 10 tries
    var FIRST = 1500                                 // the first try: give the server a moment
    var HINT_AFTER = 5                               // tries before the "check the cable" line
    var LOOP = 3, LOOP_MS = 120000                   // auto reloads allowed in that window
    var PROBE_MS = 3000
    var KEY = 'nhe.connection-reloads'               // sessionStorage: when it last reloaded by itself

    document.documentElement.classList.add('nhe-connection-on')   // MOD's blocker hidden (connection.css)

    var state = null, n = {}

    var recent = function () {
        var now = Date.now(), list = []
        try { list = JSON.parse(sessionStorage.getItem(KEY) || '[]') } catch (e) {}
        return (Array.isArray(list) ? list : []).filter(function (t) { return now - t < LOOP_MS })
    }
    var reload = function (auto) {
        if (state) state.reloading = true
        if (auto) {
            try { var list = recent(); list.push(Date.now()); sessionStorage.setItem(KEY, JSON.stringify(list)) } catch (e) {}
        }
        window.location.reload()
    }

    // the MOD's web server answers? Any reply counts (HEAD on its page may be
    // a 405), but not the dev proxy's 502 for "MOD unreachable"
    var probe = function (cb) {
        var xhr = new XMLHttpRequest(), done = false
        var end = function (up) { if (done) return; done = true; cb(up) }
        xhr.open('HEAD', '/?nhe-probe=' + Date.now())
        xhr.timeout = PROBE_MS
        xhr.onload = function () { end(xhr.status > 0 && xhr.status < 500) }
        xhr.onerror = xhr.ontimeout = xhr.onabort = function () { end(false) }
        try { xhr.send() } catch (e) { end(false) }
    }

    var build = function () {
        var el = function (tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e }
        n.overlay = el('div', 'nhe-ctl nhe-dialog-overlay nhe-connection')
        n.overlay.setAttribute('role', 'alertdialog')
        n.overlay.setAttribute('aria-modal', 'true')
        var card = el('div', 'nhe-dialog nhe-dialog--card nhe-connection__card', n.overlay)
        n.title = el('div', 'nhe-dialog__header', card)
        n.spinner = el('div', 'nhe-connection__spinner', card)
        n.status = el('p', 'nhe-connection__status', card)
        n.status.setAttribute('aria-live', 'polite')
        n.hint = el('p', 'nhe-connection__hint', card)
        var buttons = el('div', 'nhe-dialog__buttons', card)
        var pressed = false
        var go = function (e) {
            if (e) e.preventDefault()
            if (pressed) return
            pressed = true
            n.button.textContent = 'Reloading…'
            reload(false)
        }
        n.button = NHE.textButton('Reload now', 'primary', go)
        n.button.addEventListener('pointerup', go)
        buttons.appendChild(n.button)
        // Enter reloads too (the button isn't focused: that drew a ring on a touch screen)
        document.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(e) }, true)
    }

    var STATUS = {
        checking: ['Reconnecting…', 'The MOD is updating. Don’t switch it off.'],
        down: ['Can’t reach the MOD yet. Trying again…', 'Updating. The MOD restarts when it’s done: don’t switch it off.'],
        back: ['Back. Reloading…', 'Updated. Reloading…'],
        stuck: ['The MOD answers, but reloading didn’t reconnect. Is it open in another tab or browser? Close that, then reload.', null]
    }
    var render = function (kind) {
        if (!n.overlay) return
        var u = state.updating
        n.title.textContent = u ? 'Updating' : 'Connection lost'
        n.status.textContent = STATUS[kind][u ? 1 : 0] || STATUS[kind][0]
        n.hint.textContent = (!u && kind === 'down' && state.attempts >= HINT_AFTER)
            ? 'Check the MOD is on, and its USB cable or Wi-Fi is connected.' : ''
        n.overlay.classList.toggle('is-stuck', kind === 'stuck')
    }

    var schedule = function (ms) {
        clearTimeout(state.timer)
        state.timer = setTimeout(tick, ms != null ? ms : (state.attempts < PATIENT ? FAST : SLOW))
    }
    var tick = function () {
        if (!state || state.reloading || state.probing) return
        state.attempts++
        state.probing = true
        probe(function (up) {
            if (!state) return
            state.probing = false
            if (!up) { state.sawDown = true; render('down'); schedule(); return }
            // an update: the MOD restarts, so wait until it has gone and come back
            if (state.updating && !state.sawDown) { render('checking'); schedule(); return }
            if (recent().length >= LOOP) { render('stuck'); return }
            render('back')
            setTimeout(function () { reload(true) }, 300)
        })
    }
    // back in view (a tablet waking, a laptop opened), the network back, focus:
    // try at once instead of waiting for the timer
    var now = function () { if (state && !state.reloading) { clearTimeout(state.timer); tick() } }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') now() })
    window.addEventListener('online', now)
    window.addEventListener('focus', now)
    window.addEventListener('pageshow', now)

    var show = function (updating) {
        if (state) {
            if (updating && !state.updating) { state.updating = true; render('checking') }
            return
        }
        state = { updating: updating, attempts: 0, sawDown: false, timer: null, probing: false, reloading: false }
        build()
        document.body.appendChild(n.overlay)
        render('checking')
        schedule(FIRST)
    }

    mod.onBlockUI(show)
    NHE.connection = { show: show }
}, { early: true })
