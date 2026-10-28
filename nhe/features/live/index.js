// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Live surface: one screen with the controls picked from any plugin (a
 * control's settings → Add to surface). Each plugin's controls sit under its
 * name and on / off as on top of its settings screen (NHE.PluginHeader), in
 * its colour, at least two columns wide; the controls play as on the
 * plugin's own settings screen. Above
 * them, across the screen, the board's snapshots (80 px tall, the labels
 * as big as fits); the bar's chips don't show over it. The
 * system bar has the meters, no Exit, SET or Chain tab: another
 * screen in the bottom bar leaves it (features/bars: Live, left of
 * Constructor).
 *
 * Kept per board (its bundle, as the builder's layouts), in localStorage
 * "nhe-live-surface" = { bundle: ['instance/symbol', …] } (an instance is
 * a path, '/graph/…': the symbol is after the last /) in the order they
 * were added; components/config.js keeps it on the MOD. A board never saved
 * keeps its controls once Save (as) gives it a bundle.
 *
 *   NHE.liveSurface.has(instance, symbol) / set(instance, symbol, on)
 *   NHE.liveSurface.open() / close() / isOpen() / onToggle(fn(open))
 *
 * Needs the settings feature (NHE.settingsScreen: the controls' descriptions,
 * the addressing dialog).
 */
NHE.register('live', function (mod) {
    if (!NHE.settingsScreen || !NHE.settingsScreen.describe) { NHE.log('live: needs the settings feature'); return }
    var S = NHE.settingsScreen
    var KEY = 'nhe-live-surface', UNSAVED = '(unsaved)'
    var MIN_HEIGHT = 300

    // ---- what's on it ----------------------------------------------------

    var all = {}
    try { all = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) { all = {} }
    delete all[UNSAVED]
    var boardId = mod.boardId() || UNSAVED
    var list = function () { return all[boardId] || [] }
    var store = function () {
        var out = {}
        Object.keys(all).forEach(function (id) { if (id !== UNSAVED && all[id] && all[id].length) out[id] = all[id] })
        try { localStorage.setItem(KEY, JSON.stringify(out)) } catch (e) {}
    }
    var has = function (instance, symbol) { return list().indexOf(instance + '/' + symbol) >= 0 }
    var set = function (instance, symbol, on) {
        var l = list().slice(), k = instance + '/' + symbol, i = l.indexOf(k)
        if (on && i < 0) l.push(k)
        else if (!on && i >= 0) l.splice(i, 1)
        else return
        all[boardId] = l
        store()
        if (isOpen()) build()
    }
    // the board saved under another bundle (Save as, or a first Save): its controls go with it
    var followSave = function () {
        var id = mod.boardId() || UNSAVED
        if (id === boardId) return
        if (boardId === UNSAVED && all[UNSAVED]) { all[id] = all[UNSAVED]; delete all[UNSAVED] }
        else if (!all[id] && all[boardId] && !mod.boardLoading()) all[id] = all[boardId].slice()   // Save as
        boardId = id
        store()
    }

    // ---- the screen --------------------------------------------------------

    var view = mod.addView('nhe-live', '<div class="nhe-live" style="display:none"></div>')
    var snaps = $('<div class="nhe-ctl nhe-live__snaps" role="group" aria-label="Snapshots">').appendTo(view)
    var root = $('<div class="nhe-settings">').appendTo(view)
    var scroller = $('<div class="nhe-settings__scroll">').appendTo(root)
    var sizer = $('<div class="nhe-settings__sizer">').appendTo(scroller)
    var stage = $('<div class="nhe-settings__stage">').appendTo(sizer)
    var barEl = $('<div>').appendTo(stage)
    var panelEl = $('<div class="nhe-live__plugins">').appendTo(stage)
    var empty = $('<div class="nhe-ctl nhe-live__empty">').appendTo(stage)
    $('<div class="nhe-live__empty-title">').html(NHE.icons.star + '<span>Nothing on the live surface yet</span>').appendTo(empty)
    $('<div class="nhe-live__empty-note">').text("Open a control's settings (the gear by its name) and choose Add to surface. It shows here with the others you add, under its plugin's name.").appendTo(empty)

    var t = mod.tempo(), stats = mod.stats()
    var bar = new NHE.SystemBar(barEl[0], {
        tempo: t.bpm, tempoLocked: t.locked, sync: t.sync,
        cpu: stats.cpu, ram: stats.ram, xruns: stats.xruns,
        exit: false, tabs: false,      // and no SET (no onSet)
        onTempo: function (bpm) { mod.setTempo(bpm) }
    })
    mod.onStats(function (s) { bar.setStats({ cpu: s.cpu, xruns: s.xruns }); bar.setSysStats({ ram: s.ram }) })
    mod.onTempo(function (x) { bar.setTempo(x.bpm, x.locked, x.sync) })
    var hint = NHE.scrollHint(scroller[0])

    var panels = {}, headers = {}   // per plugin: its controls, its name and on / off
    var control = function (instance, symbol) {
        return symbol === ':bypass' ? headers[instance] : panels[instance] && panels[instance].control(instance + '/' + symbol)
    }
    var hooked = []            // the plugin GUIs followed (a reloaded board brings new ones)
    var follow = function (instance) {
        var gui = mod.gui(instance)
        if (!gui || hooked.indexOf(gui) >= 0) return
        hooked.push(gui)
        mod.onPortValue(instance, function (symbol, value) {
            var c = control(instance, symbol), p = (mod.gui(instance).controls || {})[symbol]
            if (!c || !p || !isOpen()) return
            if (symbol === ':bypass') c.update({ on: !value })      // MOD's bypass: 1 = off
            else if (c instanceof NHE.Toggle) c.setValue(value !== p.ranges.minimum)
            else if (c.setValue) c.setValue(value)
        })
        mod.onBindingChange(instance, function (symbol) {
            var c = control(instance, symbol)
            if (c) c.update({ binding: mod.binding(instance, symbol) })
        })
    }

    // the plugins in the order their first control was added, each with its
    // controls in its port order. A plugin not on the board (yet) is left out.
    var plugins = function () {
        var order = [], picked = {}
        list().forEach(function (k) {
            var i = k.lastIndexOf('/'), instance = k.slice(0, i)
            if (!picked[instance]) { picked[instance] = {}; order.push(instance) }
            picked[instance][k.slice(i + 1)] = true
        })
        var out = []
        order.forEach(function (instance) {
            var info = mod.pluginInfo(instance)
            if (!info) return
            follow(instance)
            var cs = []
            info.ports.forEach(function (p) {
                if (!picked[instance][p.symbol]) return
                var c = S.describe(instance, p)
                c.id = instance + '/' + p.symbol
                c.options.surface = false      // all of them are: no star here
                c.group = null                 // no port groups here (yet)
                cs.push(c)
            })
            out.push({ instance: instance, name: info.label, hex: S.colourOf(instance), controls: cs })
        })
        return out
    }
    var split = function (id) { var i = id.lastIndexOf('/'); return { instance: id.slice(0, i), symbol: id.slice(i + 1) } }

    var build = function () {
        var z = NHE.settingsZoom ? NHE.settingsZoom() : 1
        var h = Math.max(MIN_HEIGHT, Math.floor(((root.innerHeight() || view.innerHeight()) - 8) / z))
        barEl.css('height', h + 'px')
        var ps = plugins()
        // (not toggle(): that sets display: block on the row, a flex row)
        empty.css('display', ps.length ? 'none' : '')
        panelEl.css('display', ps.length ? '' : 'none')
        panelEl.empty()
        panels = {}
        headers = {}
        var send = function (id, v) { var x = split(id); S.send(x.instance, x.symbol, v) }
        ps.forEach(function (pl) {
            var instance = pl.instance
            // the plugin's name and on / off as on top of its settings screen, in
            // its colour (the colour picker's, else the accent as there), across
            // its controls
            var block = $('<div class="nhe-live__plugin">').appendTo(panelEl)
            NHE.accent.apply(block[0], pl.hex)
            var head = $('<div>').appendTo(block)
            headers[instance] = new NHE.PluginHeader(head[0], {
                name: pl.name, on: mod.pluginOn(instance), binding: mod.binding(instance, ':bypass'),
                onChange: function (on) { S.send(instance, ':bypass', on) },
                onSettings: function () { S.openAddressing(instance, ':bypass', headers[instance]) }
            })
            panels[instance] = new NHE.Panel($('<div>').appendTo(block)[0], {
                height: h - head[0].offsetHeight,
                controls: pl.controls,
                onInput: send,
                onChange: send,
                onTrigger: function (id) {
                    var x = split(id), p = (mod.gui(x.instance).controls || {})[x.symbol]
                    if (p) mod.setPortValue(x.instance, x.symbol, p.ranges.maximum)
                },
                onSettings: function (id) { var x = split(id); S.openAddressing(x.instance, x.symbol, panels[instance].control(id)) }
            })
        })
        var sr = stage[0].getBoundingClientRect()
        sizer.css({ width: Math.ceil(sr.width) + 'px', height: Math.ceil(sr.height) + 'px' })
        hint.update()
    }

    // ---- the snapshots ----------------------------------------------------

    var SNAP_FONT = 28, SNAP_FONT_MIN = 12
    var renderSnaps = function (done) {
        mod.snapshots(function (list) {
            var had = snaps.children().length > 0
            snaps.empty()
            var cur = mod.snapshotCurrent()
            list.forEach(function (s) {
                $('<button type="button" class="nhe-live__snap">').append($('<span>').text(s.name)).toggleClass('is-on', s.id === cur).appendTo(snaps)
                    .on('click', function () { if (s.id !== mod.snapshotCurrent()) mod.loadSnapshot(s.id) })
            })
            snaps.toggle(list.length > 0)
            fitSnaps()
            // the controls' height changes with the bar
            if (done) done()
            else if (had !== list.length > 0) build()
        })
    }
    // the labels at one size, the largest at which all of them fit
    var fitSnaps = function () {
        var labels = snaps.find('span'), fs = SNAP_FONT
        var spills = function () { return labels.toArray().some(function (l) { return l.scrollWidth > l.clientWidth + 1 }) }
        labels.css('font-size', fs + 'px')
        while (fs > SNAP_FONT_MIN && spills()) labels.css('font-size', --fs + 'px')
    }

    var toggles = []
    var isOpen = function () { return view.is(':visible') }
    var open = function () {
        if (isOpen()) return
        view.show()
        mod.fullBleed('live', true)
        build()
        renderSnaps(build)
        toggles.forEach(function (fn) { fn(true) })
    }
    var close = function () {
        if (!isOpen()) return
        view.hide()
        mod.fullBleed('live', false)
        panelEl.empty()
        panels = {}
        headers = {}
        toggles.forEach(function (fn) { fn(false) })
    }

    // ---- following MOD ---------------------------------------------------------

    var seen = {}            // the plugins seen on this board
    Object.keys(mod.plugins()).forEach(function (i) { seen[i] = true })
    mod.onBoardName(function () { setTimeout(followSave, 300) })   // the bundle may be set just after the title
    mod.onBoardChange(function (reloaded) {
        if (reloaded) { boardId = mod.boardId() || UNSAVED; seen = {} }   // another board: its own controls
        else {
            // a plugin removed: its controls go too (one seen on this board: not one still arriving)
            var l = list(), kept = l.filter(function (k) { var i = split(k).instance; return !seen[i] || !!mod.gui(i) })
            if (kept.length !== l.length) { all[boardId] = kept; store() }
        }
        Object.keys(mod.plugins()).forEach(function (i) { seen[i] = true })
        if (isOpen()) build()
    })
    S.onChange(function () { if (isOpen()) build() })
    mod.onPerformanceOpen(close)
    mod.onSnapshots(function () { if (isOpen()) renderSnaps() })

    var lastSize = window.innerWidth + 'x' + window.innerHeight, resizeTimer = null
    $(window).on('resize', function (e) {
        if (e.target !== window) return
        var size = window.innerWidth + 'x' + window.innerHeight
        if (size === lastSize) return
        lastSize = size
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(function () { if (isOpen()) { fitSnaps(); build() } }, 200)
    })

    NHE.liveSurface = {
        has: has, set: set,
        open: open, close: close, isOpen: isOpen,
        onToggle: function (fn) { toggles.push(fn) }
    }
})
