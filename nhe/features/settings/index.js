// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Settings panel: MOD's plugin settings window shows the NHE panel (sliders,
 * toggles, triggers, option lists, presets, plugin on/off, stacking) instead
 * of MOD's own controls. A NHE / MOD switch in the window flips back to MOD's
 * panel; the choice is remembered in this browser.
 *
 * MOD's own controls stay in the window, hidden, so MOD's code keeps working
 * and the performance view's strip (which borrows the window) still shows
 * them. Everything MOD-specific goes through NHE.mod (adapter/mod.js).
 * Specs: docs/slider-spec.md, docs/button-spec.md, docs/select-spec.md.
 */
NHE.register('settings', function (mod) {
    var VIEW_KEY = 'nhe-settings-view'     // 'nhe' | 'mod', per browser
    var TAB_KEY = 'nhe-system-bar-tab'     // 'meters' | 'chain', per browser
    var MINI_KEY = 'nhe-minimised'         // { 'instance/symbol': true }, per browser
    var COLOUR_KEY = 'nhe-plugin-colours'  // { pluginUri: '#rrggbb' }, per browser: every copy of a plugin
    var MIN_HEIGHT = 400

    var view = function () {
        try { return localStorage.getItem(VIEW_KEY) || 'nhe' } catch (e) { return 'nhe' }
    }
    var setView = function (v) {
        try { localStorage.setItem(VIEW_KEY, v) } catch (e) {}
    }
    // the system bar opens on the tab used last, in every plugin's window
    var barTab = function () {
        try { return localStorage.getItem(TAB_KEY) === 'chain' ? 'chain' : 'meters' } catch (e) { return 'meters' }
    }
    // minimised sliders (set in the addressing dialog)
    var minimisedAll = function () {
        try { return JSON.parse(localStorage.getItem(MINI_KEY) || '{}') || {} } catch (e) { return {} }
    }
    var isMinimised = function (instance, symbol) { return !!minimisedAll()[instance + '/' + symbol] }
    var setMinimised = function (instance, symbol, on) {
        var all = minimisedAll()
        if (on) all[instance + '/' + symbol] = true
        else delete all[instance + '/' + symbol]
        try { localStorage.setItem(MINI_KEY, JSON.stringify(all)) } catch (e) {}
    }

    // plugin colours (colour.js), per plugin type
    var colours = function () {
        try { return JSON.parse(localStorage.getItem(COLOUR_KEY) || '{}') || {} } catch (e) { return {} }
    }
    var colourOf = function (instance) {
        var info = mod.pluginInfo(instance)
        return (info && info.uri && colours()[info.uri]) || null
    }
    var setColour = function (uri, hex) {
        var all = colours()
        if (hex) all[uri] = hex
        else delete all[uri]
        try { localStorage.setItem(COLOUR_KEY, JSON.stringify(all)) } catch (e) {}
        // every open panel of that plugin follows
        for (var i in states) {
            var inf = states[i].info
            if (inf && inf.uri === uri) NHE.accent.apply(states[i].root[0], hex)
        }
    }

    // the addressing dialog, over MOD's own (hidden) addressing form
    var openAddressing = function (instance, symbol, win) {
        var a = mod.addressing(instance, symbol)
        if (!a) { mod.openAddressing(instance, symbol); return }
        var st = states[instance]
        var c = st && st.panel && st.panel.control(symbol)
        var slider = !!(c && NHE.Slider && c instanceof NHE.Slider)
        NHE.AddressingDialog({
            plugin: a.plugin, control: a.control, model: a.model,
            minimised: slider ? isMinimised(instance, symbol) : null,
            accent: colourOf(instance),
            onMinimise: function (on) { setMinimised(instance, symbol, on); build(instance, win) }
        })
    }

    var states = {}       // instance -> { root, panel, ... }

    // MOD port -> panel control description
    var describe = function (instance, p) {
        var props = p.properties || []
        var has = function (name) { return props.indexOf(name) >= 0 }
        var group = p.group ? { id: p.group.uri, name: p.group.name || p.group.label || p.group.symbol || '', color: p.groupCssIndex || 0 } : null
        var binding = mod.binding(instance, p.symbol)
        var title = p.shortName || p.name || p.symbol
        var base = { title: title, comment: p.comment, binding: binding }
        if (has('trigger')) return { id: p.symbol, type: 'trigger', group: group, options: base }
        if (has('toggled')) return { id: p.symbol, type: 'toggle', group: group, options: mix(base, { value: p.value !== p.ranges.minimum }) }
        if (has('enumeration') && p.scalePoints && p.scalePoints.length >= 2) {
            return { id: p.symbol, type: 'list', group: group, options: mix(base, { value: p.value, options: p.scalePoints.map(function (s) { return { label: s.label, value: s.value } }) }) }
        }
        var render = (p.units && p.units.render) || ''
        var dec = /%\.(\d+)f/.exec(render)
        return { id: p.symbol, type: 'slider', group: group, options: mix(base, {
            value: p.value, min: p.ranges.minimum, max: p.ranges.maximum,
            minimised: isMinimised(instance, p.symbol),
            unit: (p.units && p.units.symbol) || '',
            integer: has('integer'), logarithmic: has('logarithmic'),
            rangeSteps: p.rangeSteps || 0,
            // the plugin's own precision when it gives one, else 'auto' (snapping)
            decimals: has('integer') || /%d/.test(render) ? 0 : (dec ? Number(dec[1]) : 'auto'),
        }) }
    }

    var mix = function (a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o }

    var build = function (instance, win) {
        var info = mod.pluginInfo(instance)
        if (!info) return
        var st = states[instance]
        if (!st) {
            st = states[instance] = {}
            st.root = $('<div class="nhe-settings">').appendTo(win)
            st.scroller = $('<div class="nhe-settings__scroll">').appendTo(st.root)
            var stage = $('<div class="nhe-settings__stage">').appendTo(st.scroller)
            st.barEl = $('<div>').appendTo(stage)
            st.panelEl = $('<div>').appendTo(stage)
            var t = mod.tempo(), stats = mod.stats()
            st.bar = new NHE.SystemBar(st.barEl[0], {
                tempo: t.bpm, tempoLocked: t.locked, sync: t.sync,
                cpu: stats.cpu, ram: stats.ram, xruns: stats.xruns,
                tab: barTab(),
                onTab: function (tab) { try { localStorage.setItem(TAB_KEY, tab) } catch (e) {} },
                onExit: function () { mod.closeSettings(instance) },
                onTempo: function (bpm) { mod.setTempo(bpm) },
                // hop through the chain: open that plugin's settings
                onHop: function (id) { mod.closeSettings(instance); mod.openSettings(id) },
            })
            st.hint = NHE.scrollHint(st.scroller[0])

            // the NHE / MOD switch floats in the window in both views (Close is
            // the system bar's EXIT in the NHE view, MOD's own button in MOD's)
            st.switchEl = $('<div class="nhe-settings__switch">').appendTo(win)
            st.switcher = new NHE.Segmented($('<div>').appendTo(st.switchEl)[0], { options: ['NHE', 'MOD'], value: 0, onChange: function (i) {
                setView(i ? 'mod' : 'nhe')
                apply(instance, win)
            } })

            // keep the panel in step with MOD
            mod.onPortValue(instance, function (symbol, value) {
                if (!st.panel) return
                if (symbol === ':bypass') { if (st.panel.header) st.panel.header.update({ on: !value }); return }
                var c = st.panel.control(symbol), p = (mod.gui(instance).controls || {})[symbol]
                if (!c || !p) return
                if (c instanceof NHE.Toggle) c.setValue(value !== p.ranges.minimum)
                else if (c.setValue) c.setValue(value)
            })
            mod.onBindingChange(instance, function (symbol) {
                if (!st.panel) return
                if (symbol === ':bypass') { if (st.panel.header) st.panel.header.update({ binding: mod.binding(instance, ':bypass') }); return }
                if (symbol === ':presets') { refreshPresets(instance); return }
                var c = st.panel.control(symbol)
                if (c) c.update({ binding: mod.binding(instance, symbol) })
            })
            mod.onPresetsChange(instance, function () { refreshPresets(instance) })
            mod.onFilesChange(instance, function () { refreshFiles(instance) })
        }
        st.info = info
        NHE.accent.apply(st.root[0], colourOf(instance))

        // the column height follows the window
        var h = Math.max(MIN_HEIGHT, Math.floor((st.root.innerHeight() || win.innerHeight()) - 8))

        st.barEl.css('height', h + 'px')
        st.bar.update({ plugin: info.label, chain: mod.neighbours(instance), tab: barTab() })

        st.panel = new NHE.Panel(st.panelEl[0], {
            height: h,
            plugin: { name: info.label, on: mod.pluginOn(instance), binding: mod.binding(instance, ':bypass'),
                      presets: presetOptions(instance),
                      onColour: info.uri ? function () {
                          NHE.ColourDialog({ plugin: info.label, value: colourOf(instance), onPick: function (hex) { setColour(info.uri, hex) } })
                      } : null },
            controls: info.ports.filter(function (p) { return (p.properties || []).indexOf('notOnGUI') < 0 }).map(function (p) { return describe(instance, p) }),
            onInput: function (id, v) { send(instance, id, v) },
            onChange: function (id, v) { send(instance, id, v) },
            onTrigger: function (id) { var p = mod.gui(instance).controls[id]; if (p) mod.setPortValue(instance, id, p.ranges.maximum) },
            onSettings: function (id) { openAddressing(instance, id, win) },
            onPreset: function (action, p) { mod.presetAction(instance, action, p && p.id) },
            files: fileOptions(instance),
            onFile: function (uri, value) { mod.fileAction(instance, uri, value) },
            onT3K: function (uri) { mod.fileT3K(instance, uri) },
        })
        st.hint.update()
    }

    var presetOptions = function (instance) {
        var p = mod.presets(instance)
        var b = mod.binding(instance, ':presets')
        return { factory: p.factory, user: p.user, selected: p.selected, binding: b }
    }

    var fileOptions = function (instance) {
        return mod.fileLists(instance).map(function (f) { return { uri: f.uri, title: f.label, items: f.items, t3k: f.t3k } })
    }

    var refreshFiles = function (instance) {
        var st = states[instance]
        if (!st || !st.panel || !st.panel.files) return
        fileOptions(instance).forEach(function (f) { var c = st.panel.files[f.uri]; if (c) c.update({ items: f.items, t3k: f.t3k }) })
    }

    var refreshPresets = function (instance) {
        var st = states[instance]
        if (st && st.panel && st.panel.presets) st.panel.presets.update(presetOptions(instance))
    }

    // a panel value -> MOD
    var send = function (instance, id, v) {
        if (id === ':bypass') { mod.setPluginOn(instance, v); return }
        var p = (mod.gui(instance).controls || {})[id]
        if (!p) return
        if (typeof v === 'boolean') v = v ? p.ranges.maximum : p.ranges.minimum
        mod.setPortValue(instance, id, Number(v))
    }

    var apply = function (instance, win) {
        var v = view()
        win.toggleClass('nhe-settings-on', v === 'nhe')
        states[instance].switcher.update({ value: v === 'nhe' ? 0 : 1 })
        if (v === 'nhe') build(instance, win)
    }

    // live system bar data, for every panel that exists
    mod.onStats(function (stats) {
        for (var i in states) if (states[i].bar) { states[i].bar.setStats({ cpu: stats.cpu, xruns: stats.xruns }); states[i].bar.setSysStats({ ram: stats.ram }) }
    })
    var tempoHooked = false
    var hookTempo = function () {
        if (tempoHooked) return
        tempoHooked = true
        mod.onTempo(function (t) { for (var i in states) if (states[i].bar) states[i].bar.setTempo(t.bpm, t.locked, t.sync) })
    }

    mod.onSettingsOpen(function (instance, win) {
        hookTempo()
        if (!states[instance]) build(instance, win)
        // build once the window is laid out, so the height is known
        setTimeout(function () { apply(instance, win) }, 0)
    })

    // Rebuild only when the window really changes size. MOD's page fires
    // 'resize' on window every few hundred ms (jquery.ba-resize, pedalboard
    // adapting), and rebuilding on each one replaced the thumbs and rows under
    // the pointer: lost clicks, broken drags.
    var lastSize = window.innerWidth + 'x' + window.innerHeight
    var resizeTimer = null
    $(window).on('resize', function (e) {
        if (e.target !== window) return
        var size = window.innerWidth + 'x' + window.innerHeight
        if (size === lastSize) return
        lastSize = size
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(function () {
            for (var i in states) {
                var win = states[i].root.parent()
                if (win.is(':visible') && win.hasClass('nhe-settings-on')) build(i, win)
            }
        }, 200)
    })
})
