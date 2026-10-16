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
    var TOOLBAR = 44
    var MIN_HEIGHT = 400

    var view = function () {
        try { return localStorage.getItem(VIEW_KEY) || 'nhe' } catch (e) { return 'nhe' }
    }
    var setView = function (v) {
        try { localStorage.setItem(VIEW_KEY, v) } catch (e) {}
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
            unit: (p.units && p.units.symbol) || '',
            integer: has('integer'), logarithmic: has('logarithmic'),
            rangeSteps: p.rangeSteps || 0,
            decimals: has('integer') ? 0 : (dec ? Number(dec[1]) : 2),
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
            var bar = $('<div class="nhe-settings__bar">').appendTo(st.root)
            st.note = $('<div class="nhe-settings__note">').appendTo(bar)
            st.close = NHE.textButton('Close', 'secondary', function () { mod.closeSettings(instance) })
            $(st.close).addClass('nhe-settings__close').appendTo(bar)
            st.scroller = $('<div class="nhe-settings__scroll">').appendTo(st.root)
            st.panelEl = $('<div>').appendTo(st.scroller)
            st.hint = NHE.scrollHint(st.scroller[0])

            // the NHE / MOD switch sits in the window in both views
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
        }
        st.info = info

        // the column height follows the window
        var h = Math.max(MIN_HEIGHT, Math.floor((st.root.innerHeight() || win.innerHeight()) - TOOLBAR - 8))
        var notes = []
        if (info.parameters.length) notes.push('Files and text settings: switch to MOD')
        st.note.text(notes.join(' · '))

        st.panel = new NHE.Panel(st.panelEl[0], {
            height: h,
            plugin: { name: info.label, on: mod.pluginOn(instance), binding: mod.binding(instance, ':bypass'),
                      presets: presetOptions(instance) },
            controls: info.ports.filter(function (p) { return (p.properties || []).indexOf('notOnGUI') < 0 }).map(function (p) { return describe(instance, p) }),
            onInput: function (id, v) { send(instance, id, v) },
            onChange: function (id, v) { send(instance, id, v) },
            onTrigger: function (id) { var p = mod.gui(instance).controls[id]; if (p) mod.setPortValue(instance, id, p.ranges.maximum) },
            onSettings: function (id) { mod.openAddressing(instance, id) },
            onPreset: function (action, p) { mod.presetAction(instance, action, p && p.id) },
        })
        st.hint.update()
    }

    var presetOptions = function (instance) {
        var p = mod.presets(instance)
        var b = mod.binding(instance, ':presets')
        return { factory: p.factory, user: p.user, selected: p.selected, binding: b }
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

    mod.onSettingsOpen(function (instance, win) {
        if (!states[instance]) build(instance, win)
        // build once the window is laid out, so the height is known
        setTimeout(function () { apply(instance, win) }, 0)
    })

    $(window).on('resize', function (e) {
        if (e.target !== window) return
        for (var i in states) {
            var win = states[i].root.parent()
            if (win.is(':visible') && win.hasClass('nhe-settings-on')) build(i, win)
        }
    })
})
