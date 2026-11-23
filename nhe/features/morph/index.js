// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Morph targets: one Morph slider moves up to 10 of the live surface's
 * sliders between two positions, A (min) and B (max), recorded with Set min
 * and Set max. It lives in the
 * live surface's system bar (its Morph tab) and as a slider placed before
 * the surface's controls.
 *
 * It runs on the MOD, not in the browser: the Morph slider is the Control of
 * MOD's "Control to CV" plugin, added to the board for it (hidden in NHE's
 * builder unless "Show CV setup in constructor" is ticked); its CV output is a CV source,
 * and every morphed slider is CV-addressed to it with A as its minimum and B
 * as its maximum (B may be below A). So a knob, MIDI or an expression pedal
 * on the Morph slider morphs with the tablet closed. Moving the tablet as
 * fast as that backs the Duo up (see ROADMAP: tested).
 *
 *   - Switch on: Set min records A, Set max records B, in either order
 *     (every live-surface slider not assigned elsewhere). Each sets only its
 *     own end: the other is kept. The sliders whose A and B differ (the
 *     first 10) morph; Morph goes to the end just set, so nothing set jumps.
 *   - A morphed slider moved on the live surface breaks free (its CV
 *     addressing dropped); when Morph moves it snaps back. Set min / Set max
 *     takes its new place as that end. A morphed slider still following
 *     Morph keeps its ends (its place is Morph's): to change an end, move
 *     Morph there, move the sliders, press that end's Set.
 *   - A snapshot sets the values saved in it, Morph's and the morphed
 *     sliders' too: once it has loaded, Morph goes back to where it stood
 *     and the morphed sliders to their places on it (free ones snap back).
 *   - Switch off: every morphed slider is released; A and B are kept and
 *     come back when switched on.
 *   - A slider assigned to something else (a knob, MIDI) can't morph: an
 *     orange ring while Morph is on; one that can, a green ring.
 *
 * Kept per board (its bundle) in localStorage "nhe-morph" = { bundle: { on,
 * instance, a: { 'instance/symbol': value }, b, last: 'a'|'b' (set last),
 * keys: [...] } }, and "nhe-morph-show" = 'true' to show the plugin in the
 * builder; components/config.js keeps both on the MOD. A board loaded with
 * Morph on gets its plugin, source and addressings back if it wasn't saved
 * with them.
 *
 *   NHE.morph.attach(el)               // the Morph tab's page (the system bar's)
 *   NHE.morph.slider()                 // { instance, port } of the Morph slider, or null (off)
 *   NHE.morph.paint(control, instance, symbol)   // its ring on a live-surface control
 *   NHE.morph.binding(instance, symbol, binding) // the binding to show (a morphed one isn't locked)
 *   NHE.morph.touched(instance, symbol)          // a live-surface slider moved by hand
 *   NHE.morph.surfaceChanged()         // a control added to / removed from the surface
 *   NHE.morph.hides(instance)          // hidden in the builder
 *   NHE.morph.dismantle(cb)            // released and its plugin removed (SET → Live surface → Off)
 *
 * Needs the settings feature; the live feature shows it. Off with the live
 * surface (SET → Live surface, NHE.liveShown).
 */
NHE.register('morph', function (mod) {
    if (NHE.liveShown && !NHE.liveShown()) { NHE.log('morph: the live surface is switched off'); return }
    var KEY = 'nhe-morph', SHOW_KEY = 'nhe-morph-show', UNSAVED = '(unsaved)'
    var URI = 'http://moddevices.com/plugins/mod-devel/mod-cv-control'
    var CONTROL = 'Control', OUTPUT = 'Cvoutput', TOP = 10, MAX = 10
    var SOURCE_NAME = 'Morph'

    // ---- kept state --------------------------------------------------------

    var all = {}
    try { all = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) { all = {} }
    delete all[UNSAVED]
    var boardId = mod.boardId() || UNSAVED
    var st = function () {
        var s = all[boardId]
        if (!s) s = all[boardId] = { on: false, instance: null, a: {}, b: {}, keys: [] }
        return s
    }
    var store = function () {
        var out = {}
        Object.keys(all).forEach(function (id) { if (id !== UNSAVED) out[id] = all[id] })
        try { localStorage.setItem(KEY, JSON.stringify(out)) } catch (e) {}
    }
    var showInBuilder = function () { try { return localStorage.getItem(SHOW_KEY) === 'true' } catch (e) { return false } }

    var free = {}            // morphed sliders broken free on the surface (this session)
    var busy = false         // addressing in flight
    var moveQueued = false
    var split = function (k) { var i = k.lastIndexOf('/'); return { instance: k.slice(0, i), symbol: k.slice(i + 1) } }
    var port = function (k) { var x = split(k), g = mod.gui(x.instance); return g && g.controls[x.symbol] }
    var value = function (k) { var p = port(k); return p ? Number(p.value) : null }
    var source = function () { return st().instance ? mod.cvSourceUri(st().instance + '/' + OUTPUT) : null }
    var present = function () { return !!(st().instance && mod.gui(st().instance)) }
    var morphValue = function () { var g = present() && mod.gui(st().instance); return g ? Number(g.controls[CONTROL].value) : 0 }

    // a slider that can morph: continuous, and not addressed to anything but Morph
    var continuous = function (k) {
        var p = port(k)
        return !!p && !(p.properties || []).some(function (x) { return /toggled|enumeration|integer|trigger/.test(x) })
    }
    var assignedElsewhere = function (k) {
        var x = split(k), a = mod.addressingOf(x.instance, x.symbol)
        return !!a && a.uri !== source()
    }
    var surfaceKeys = function () { return NHE.liveSurface && NHE.liveSurface.list ? NHE.liveSurface.list() : [] }
    var eligible = function () { return surfaceKeys().filter(function (k) { return continuous(k) && !assignedElsewhere(k) }) }
    var has = function (end) { return Object.keys(st()[end] || {}).length > 0 }
    // before a morph: the sliders moved since the end set last
    var changed = function () {
        var s = st(), at = s[s.last || 'a'] || {}
        return eligible().filter(function (k) { return at[k] !== undefined && Math.abs(value(k) - at[k]) > 1e-6 })
    }

    // ---- MOD: the plugin, the source, the addressings ------------------------

    // the Control to CV plugin on the board and its output a CV source
    var ensurePlugin = function (cb) {
        var s = st()
        var withSource = function () {
            var p = s.instance + '/' + OUTPUT
            if (mod.hasCvSource(p)) { cb(true); return }
            mod.addCvSource(p, SOURCE_NAME, cb)
        }
        if (present()) { withSource(); return }
        // one already on the board (saved with it)
        var found = mod.board().pedals.filter(function (p) { return p.uri === URI && p.instance === s.instance })[0]
        if (found) { withSource(); return }
        var b = mod.board(), y = 0
        b.pedals.forEach(function (p) { y = Math.max(y, p.y + p.h) })
        mod.addPlugin(URI, 40, y + 80, function (instance) {
            if (!instance) { cb(false); return }
            s.instance = instance
            store()
            // let MOD draw it (its CV jack's checkbox) before the source goes on;
            // Morph starts at 0 (A)
            setTimeout(function () { setMorph(0); withSource() }, 600)
        })
    }
    // address keys to Morph over their A .. B (or release them: on = false), all at once
    var address = function (keys, on, cb) {
        var s = st(), left = keys.length, src = source()
        if (!left) { if (cb) cb(); return }
        busy = true
        keys.forEach(function (k) {
            var x = split(k)
            var next = function () { if (--left === 0) { busy = false; render(); refresh(); if (cb) cb() } }
            if (on) mod.cvAddress(x.instance, x.symbol, src, s.a[k], s.b[k], next)
            else mod.cvAddress(x.instance, x.symbol, null, 0, 1, next)
        })
    }
    var setMorph = function (v) { if (present()) mod.setPortValue(st().instance, CONTROL, v) }

    // ---- what Set and the switch do -----------------------------------------

    var record = function (into) { var out = {}; eligible().forEach(function (k) { out[k] = value(k) }); st()[into] = out }

    var switchOn = function (on) {
        var s = st()
        if (busy) return
        s.on = on
        store()
        free = {}
        if (!on) { address(s.keys, false); render(); refresh(); return }
        ensurePlugin(function (ok) {
            if (!ok) { s.on = false; store(); mod.notify('error', 'Morph: could not add Control to CV'); render(); return }
            watch()
            if (s.keys.length) address(s.keys, true)
            render()
            refresh()
        })
        render()
    }

    // Set min (end 'a') / Set max ('b'): the sliders' places now become that
    // end, the other end kept; then every slider with two different ends morphs
    var setEnd = function (end) {
        var s = st()
        if (!s.on || busy) return
        // a morphed slider following Morph is at Morph's place, not one set by hand
        var follows = function (k) { return s.keys.indexOf(k) >= 0 && !free[k] }
        if (!s[end]) s[end] = {}
        eligible().forEach(function (k) { if (!follows(k)) s[end][k] = value(k) })
        s.last = end
        delete s.phase
        var differ = function (k) { return s.a[k] !== undefined && s.b && s.b[k] !== undefined && Math.abs(s.a[k] - s.b[k]) > 1e-6 }
        var can = eligible()
        var keys = s.keys.filter(function (k) { return can.indexOf(k) >= 0 })
            .concat(can.filter(function (k) { return s.keys.indexOf(k) < 0 }))
            .filter(differ).slice(0, MAX)
        var dropped = s.keys.filter(function (k) { return keys.indexOf(k) < 0 })
        var added = keys.filter(function (k) { return s.keys.indexOf(k) < 0 || free[k] })
        s.keys = keys
        free = {}
        store()
        if (keys.length) setMorph(end === 'a' ? 0 : TOP)     // at the end just set: nothing set jumps
        address(dropped, false, function () { address(added, true) })
        render()
    }

    // a morphed slider moved by hand: it breaks free until Morph moves
    var touched = function (instance, symbol) {
        var s = st(), k = instance + '/' + symbol
        if (!s.on || s.keys.indexOf(k) < 0 || free[k]) return
        free[k] = true
        var v = value(k)
        mod.cvAddress(instance, symbol, null, 0, 1, function () {
            // the hand's latest value, not what CV left behind
            var p = port(k)
            if (p && free[k]) mod.setPortValue(instance, symbol, p.value !== undefined ? p.value : v)
            render()
            refresh()
        })
        render()
    }
    var snapBack = function () {
        var f = Object.keys(free)
        if (!f.length || busy) return
        free = {}
        address(f, true)
    }

    // ---- the Morph tab -------------------------------------------------------

    var page = null, sw = null, setMin = null, setMax = null, note = null, count = null, show = null
    var attach = function (el) {
        page = el
        el.classList.add('nhe-morph')
        sw = new NHE.Toggle($('<div>').appendTo(el)[0], { title: 'Morph targets', value: st().on, onChange: function (on) { switchOn(on) } })
        var ends = $('<div class="nhe-morph__ends">').appendTo(el)[0]
        setMin = new NHE.Trigger($('<div>').appendTo(ends)[0], { title: 'Set min', onTrigger: function () { setEnd('a') } })
        setMax = new NHE.Trigger($('<div>').appendTo(ends)[0], { title: 'Set max', onTrigger: function () { setEnd('b') } })
        note = $('<div class="nhe-card nhe-morph__note" role="status">').appendTo(el)
        count = $('<div class="nhe-morph__count">').appendTo(el)
        var label = $('<label class="nhe-morph__show">').appendTo(el)
        show = $('<input type="checkbox">').prop('checked', showInBuilder()).appendTo(label)
        $('<span>').text('Show CV setup in constructor').appendTo(label)
        show.on('change', function () {
            try { localStorage.setItem(SHOW_KEY, this.checked ? 'true' : 'false') } catch (e) {}
            if (NHE.builder && NHE.builder.refresh) NHE.builder.refresh()
        })
        render()
    }

    var render = function (message) {
        if (!page) return
        var s = st(), n = 0, text = '', counted = ''
        sw.setValue(s.on)
        page.classList.toggle('is-on', !!s.on)
        if (!s.on) text = s.keys.length ? 'Last used Min and Max settings are saved. Turn on to restore.' : 'Morph lets you control up to ' + MAX + ' sliders simultaneously between a min and max position.'
        else if (busy) text = 'Working…'
        else if (!eligible().length) text = 'Add sliders to the live surface first (a control\'s settings → Add to surface).'
        else if (!s.keys.length) {
            var other = s.last === 'b' ? 'min' : 'max'
            if (!has('a') && !has('b')) text = 'Move your controls to their minimum and press "Set min", or to their maximum and press "Set max".'
            else {
                text = (s.last === 'b' ? 'Max' : 'Min') + ' set. Move your controls to their ' + other + 'imum and press "Set ' + other + '" to create a morph.'
                n = changed().length
                counted = n > MAX ? n + ' sliders changed: the first ' + MAX + ' will morph' : n + ' of ' + MAX + ' sliders changed'
            }
        } else {
            var f = Object.keys(free).length
            text = f ? f + ' broken free. Move Morph to snap ' + (f === 1 ? 'it' : 'them') + ' back, or press "Set min" or "Set max" to keep ' + (f === 1 ? 'it' : 'them') + ' there.'
                     : 'Morphing ' + s.keys.length + ' slider' + (s.keys.length === 1 ? '' : 's') + '. To change an end, move Morph to it, move the sliders and press its "Set".'
        }
        note.text(message || text)
        count.text(counted).toggle(!!counted)
        setMin.root.classList.toggle('is-disabled', !s.on || busy)
        setMax.root.classList.toggle('is-disabled', !s.on || busy)
    }
    var refresh = function () { if (NHE.liveSurface && NHE.liveSurface.rebuild) NHE.liveSurface.rebuild() }

    // ---- the live surface's controls --------------------------------------------

    var slider = function () {
        if (!st().on || !present()) return null
        var info = mod.pluginInfo(st().instance)
        var p = info && info.ports.filter(function (q) { return q.symbol === CONTROL })[0]
        return p ? { instance: st().instance, port: p } : null
    }
    var paint = function (c, instance, symbol) {
        if (!c || !c.root) return
        var s = st(), k = instance + '/' + symbol, on = s.on && continuous(k)
        var blocked = on && assignedElsewhere(k)
        c.root.classList.toggle('is-morph', on && !blocked && !free[k])
        c.root.classList.toggle('is-morph-free', on && !!free[k])
        c.root.classList.toggle('is-morph-blocked', blocked)
    }
    // a morphed slider shows as playable (not CV-locked): moving it breaks it free
    var binding = function (instance, symbol, b) {
        var s = st(), k = instance + '/' + symbol
        return b && b.type === 'cv' && s.on && s.keys.indexOf(k) >= 0 ? null : b
    }
    var surfaceChanged = function () {
        var s = st(), on = surfaceKeys()
        var gone = s.keys.filter(function (k) { return on.indexOf(k) < 0 })
        if (!gone.length) { render(); return }
        s.keys = s.keys.filter(function (k) { return on.indexOf(k) >= 0 })
        store()
        if (s.on) address(gone, false)
        render()
    }

    // ---- following MOD --------------------------------------------------------------

    var watched = null
    var watch = function () {
        var s = st()
        if (!present() || watched === mod.gui(s.instance)) return
        watched = mod.gui(s.instance)
        noteMove(morphValue(), 0)        // where it stands now, however long ago
        mod.onPortValue(s.instance, function (symbol) { if (symbol === CONTROL) { noteMove(morphValue(), Date.now()); snapBack() } })
    }
    // Morph's recent places, [{ v, t }]: where it stood before a snapshot's
    // values arrived (they come within LOAD_MS of its "pedal_snapshot")
    var moves = [], LOAD_MS = 1500
    var noteMove = function (v, t) { moves.push({ v: v, t: t }); if (moves.length > 50) moves.shift() }
    var stoodAt = function (now) {
        var before = moves.filter(function (m) { return m.t < now - LOAD_MS })
        return before.length < moves.length && before.length ? before[before.length - 1].v : null
    }
    mod.onSnapshotLoaded(function () {
        var s = st(), now = Date.now(), v = stoodAt(now)
        if (!s.on || !present() || !s.keys.length || busy) return
        if (v !== null && v !== morphValue()) setMorph(v)
        // the snapshot set the morphed sliders too: back on Morph
        free = {}
        address(s.keys, true)
        noteMove(v !== null ? v : morphValue(), now - LOAD_MS)
    })
    // a board loaded with Morph on: its plugin, source and addressings back
    var restore = function () {
        // New: an empty, unsaved board starts with Morph off, whatever an
        // earlier unsaved board had
        if (boardId === UNSAVED && !mod.board().pedals.length) delete all[UNSAVED]
        var s = st()
        free = {}
        if (s.instance && !present()) {
            // the plugin went (removed in MOD's builder, or the board wasn't saved with it)
            var other = mod.board().pedals.filter(function (p) { return p.uri === URI })[0]
            if (other) s.instance = other.instance
        }
        if (!s.on) { render(); return }
        // Control to CV goes back only on a board that has the sliders it morphs
        if (!present() && !s.keys.some(port)) { render(); return }
        ensurePlugin(function (ok) {
            if (!ok) { render(); return }
            watch()
            var src = source()
            var missing = s.keys.length ? s.keys.filter(function (k) { var x = split(k), a = mod.addressingOf(x.instance, x.symbol); return port(k) && (!a || a.uri !== src) }) : []
            address(missing, true)
            render()
            refresh()
        })
    }
    mod.onBoardName(function () {
        setTimeout(function () {
            var id = mod.boardId() || UNSAVED
            if (id === boardId) return
            if (boardId === UNSAVED && all[UNSAVED]) { all[id] = all[UNSAVED]; delete all[UNSAVED] }
            // Save as: the same board under a new name, its Control to CV still
            // on it (New renames too, but clears the board: nothing to copy)
            else if (!all[id] && all[boardId] && !mod.boardLoading() && all[boardId].instance && mod.gui(all[boardId].instance)) all[id] = JSON.parse(JSON.stringify(all[boardId]))
            boardId = id
            store()
        }, 300)
    })
    var settle = null, reloading = false
    mod.onBoardChange(function (reloaded) {
        if (reloaded) { boardId = mod.boardId() || UNSAVED; watched = null; reloading = true }
        // plugins arrive one by one: once the board is quiet (later changes
        // of the same load keep the restore waiting)
        clearTimeout(settle)
        settle = setTimeout(function () {
            // the bundle can change after the first of the load's events: the board's own state
            if (reloading) { reloading = false; boardId = mod.boardId() || UNSAVED; restore() } else { watch(); render() }
        }, reloading ? 1500 : 300)
    })
    setTimeout(restore, 1500)

    // SET → Live surface → Off: Morph's sliders released and its Control to
    // CV taken off this board (other boards keep theirs until loaded and
    // removed by hand); cb() once done
    var dismantle = function (cb) {
        var s = st(), done = false
        var finish = function () { if (!done) { done = true; cb() } }
        var removePlugin = function () {
            if (!present()) { finish(); return }
            mod.removePlugin(s.instance, finish)
            setTimeout(finish, 3000)       // MOD's removal without a callback
        }
        if (s.on && s.keys.length) address(s.keys, false, removePlugin)
        else removePlugin()
    }

    NHE.morph = {
        attach: attach, dismantle: dismantle, slider: slider, paint: paint, binding: binding,
        touched: touched, surfaceChanged: surfaceChanged,
        hides: function (instance) { return !showInBuilder() && instance === st().instance },
        // a control's value changed: before a morph, the count of changed sliders (once a frame)
        moved: function () {
            if (!st().on || st().keys.length || moveQueued) return
            moveQueued = true
            requestAnimationFrame(function () { moveQueued = false; render() })
        }
    }
})
