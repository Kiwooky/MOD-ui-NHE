// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE.mod: the ONLY place that touches MOD's internals.
 *
 * Features talk to this object, never to MOD's globals or private methods
 * directly. When a MOD release changes something, fix it here.
 *
 * What it relies on, safest first:
 *   - HTTP endpoints / the websocket       (shared with device, app, other browsers)
 *   - modgui.js GUI objects                 (standalone library, also used by the SDK)
 *   - globals: desktop, PREFERENCES, WINDOWMANAGER, element ids in index.html
 *   - wrapping $.fn.pedalboard               (most fragile; see guardPedalboard)
 *
 * Checked against mod-ui 1.14 RC4 (v1.14.0.3366) and master 2026-10-07.
 */
(function () {
    var mod = NHE.mod = {}

    // ------------------------------------------------------------------
    // lifecycle

    // runs cb once MOD's UI has built its desktop and pedalboard
    mod.ready = function (cb) {
        var check = function () {
            if (window.desktop && desktop.pedalboard && desktop.pedalboard.data('plugins')) {
                cb()
            } else {
                setTimeout(check, 100)
            }
        }
        $(check)
    }

    // ------------------------------------------------------------------
    // globals, behind names we control

    mod.desktop = function () { return window.desktop }
    mod.pedalboard = function () { return desktop.pedalboard }        // jQuery element
    mod.plugins = function () { return desktop.pedalboard.data('plugins') || {} }  // instance -> icon
    mod.gui = function (instance) {
        var icon = mod.plugins()[instance]
        return icon && icon.data ? icon.data('gui') : null
    }
    mod.preference = function (key) { return (window.PREFERENCES || {})[key] }
    mod.setPreference = function (key, value) {
        // same endpoint Settings uses; persists in /data on the device
        window.PREFERENCES = window.PREFERENCES || {}
        PREFERENCES[key] = value
        return $.ajax({ url: '/config/set', type: 'POST', data: { key: key, value: value } })
    }

    // ------------------------------------------------------------------
    // footer bar (#main-menu)

    // adds an icon after `afterSelector` (default: the Constructor icon)
    mod.addFooterIcon = function (id, title, afterSelector) {
        var existing = $('#main-menu #' + id)
        if (existing.length) return existing
        var icon = $('<div class="icon">').attr('id', id).attr('data-message', title)
        icon.insertAfter($(afterSelector || '#main-menu #mod-plugins'))
        if ($.fn.statusTooltip) icon.statusTooltip()
        return icon
    }
    mod.constructorIcon = function () { return $('#main-menu #mod-plugins') }

    // the full-height area between MOD's header and footer, for views
    mod.addView = function (id, html) {
        var existing = $('#' + id)
        if (existing.length) return existing
        return $(html).attr('id', id).insertBefore($('#main-menu'))
    }

    // ------------------------------------------------------------------
    // Pedalboard guard (the fragile part)
    //
    // While a feature has borrowed plugin icons off the canvas (performance
    // view), set  mod.pedalboard().data('performanceMode', true)  and:
    //  - canvas layout pauses (fitToWindow is deferred until it's cleared)
    //  - value/enable/parameter updates from the host go straight to the
    //    plugin's GUI, because pedalboard.js only looks for icons on the canvas
    //
    // This mirrors the small pedalboard.js changes on the performance-view
    // branch; once those are upstream this wrapper becomes unnecessary.
    var guarded = false
    mod.guardPedalboard = function () {
        if (guarded) return
        guarded = true
        var original = $.fn.pedalboard
        $.fn.pedalboard = function (method) {
            var self = this
            if (self.data && self.data('performanceMode')) {
                if (method === 'fitToWindow') {
                    self.data('performancePendingFit', true)
                    return self
                }
                if (method === 'adapt' || method === 'focusPlugin' || method === 'drawPluginJacks') {
                    return self
                }
                var a = arguments
                var icon = (self.data('plugins') || {})[a[1]]
                var gui = icon && icon.data && icon.data('gui')
                if (gui && !$.contains(self[0], icon[0]) && $.contains(document.documentElement, icon[0])) {
                    if (method === 'setPortWidgetsValue') {
                        gui.setPortWidgetsValue(a[2], a[3], null, true)
                        return
                    }
                    if (method === 'setPortEnabled') {
                        if (a[3] || a[4]) gui.enable(a[2]); else gui.disable(a[2])
                        if (a[5]) gui.addressPort(a[2], a[4], a[6])
                        return
                    }
                    if (method === 'setWritableParameterValue') {
                        gui.setWritableParameterValue(a[2], a[3], a[4], null, true)
                        return
                    }
                }
            }
            return original.apply(this, arguments)
        }
    }

    // ------------------------------------------------------------------
    // Plugin settings (the NHE settings panel)
    //
    // Relies on modgui.js's GUI object (gui.controls, gui.effect,
    // gui.setPortValue, gui.setPortWidgetsValue, gui.enable / disable /
    // addressPort, gui.selectPreset, gui.currentPreset, gui.settings) and on
    // pedalboard.js keeping the settings window in icon.data('settings') and
    // the hardware manager in pedalboard.data('hardwareManager'). Preset
    // actions click MOD's own (hidden) preset elements so MOD's dialogs and
    // requests are reused unchanged.

    // the settings windows ('.mod-settings') fire 'windowopen' / 'windowclose'
    // (window.js); both bubble, so one listener sees every plugin
    mod.onSettingsOpen = function (cb) {
        $('body').on('windowopen', '.mod-settings', function (e) {
            if (e.target !== this) return
            var instance = $(this).attr('mod-instance')
            if (instance) cb(instance, $(this))
        })
    }

    mod.closeSettings = function (instance) {
        var icon = mod.plugins()[instance]
        var s = icon && icon.data('settings')
        if (s) s.window('close')
    }

    // the plugin's description, for building the panel
    mod.pluginInfo = function (instance) {
        var gui = mod.gui(instance), icon = mod.plugins()[instance]
        if (!gui) return null
        var e = gui.effect || {}
        var ports = ((e.ports && e.ports.control && e.ports.control.input) || []).map(function (p) {
            return gui.controls[p.symbol] || p      // controls[] has the live value and sample-rate ranges
        })
        return {
            instance: instance,
            label: (icon && icon.data('label')) || e.label || e.name,
            name: e.name, brand: e.brand,
            ports: ports,
            // LV2 parameters (files, strings): not handled by the NHE panel yet
            parameters: (e.parameters || []).filter(function (p) { return p.writable }),
            customTemplate: !!(e.gui && e.gui.settingsTemplate),
        }
    }

    mod.portValue = function (instance, symbol) {
        var gui = mod.gui(instance)
        return gui && gui.controls[symbol] ? gui.controls[symbol].value : null
    }

    // through MOD's own path: tells the host and updates MOD's widgets
    mod.setPortValue = function (instance, symbol, value) {
        var gui = mod.gui(instance)
        if (!gui || !gui.controls[symbol]) return
        gui.setPortValue(symbol, value)
    }

    // wrap a GUI method once, calling every listener after MOD's own code
    var listeners = {}
    var hook = function (instance, method, cb) {
        var gui = mod.gui(instance)
        if (!gui) return
        var key = instance + '|' + method
        if (!listeners[key]) {
            listeners[key] = []
            var original = gui[method]
            gui[method] = function () {
                var r = original.apply(this, arguments)
                var args = arguments
                listeners[key].forEach(function (fn) { try { fn.apply(null, args) } catch (err) { if (window.console) console.error(err) } })
                return r
            }
        }
        listeners[key].push(cb)
    }

    // values from anywhere (host feedback, MIDI, presets, snapshots, our own changes)
    mod.onPortValue = function (instance, cb) {
        hook(instance, 'setPortWidgetsValue', function (symbol, value) { cb(symbol, value) })
    }

    // bindings changed (MOD calls these when addressing or unaddressing)
    mod.onBindingChange = function (instance, cb) {
        ['enable', 'disable', 'addressPort'].forEach(function (m) { hook(instance, m, function (symbol) { cb(symbol) }) })
    }

    // { type: 'midi'|'cv'|'device'|'chain'|'tempo', kind, label, locked } or null.
    // locked = MOD disabled the control (the source takes no feedback)
    mod.binding = function (instance, symbol) {
        var hw = mod.pedalboard().data('hardwareManager') || (desktop && desktop.hardwareManager)
        var gui = mod.gui(instance)
        if (!hw || !gui) return null
        var key = instance + '/' + symbol
        var uri = hw.addressingsByPortSymbol && hw.addressingsByPortSymbol[key]
        if (!uri || uri === 'null') return null
        var data = (hw.addressingsData && hw.addressingsData[key]) || {}
        var port = gui.controls[symbol]
        var locked = port ? port.enabled === false : false
        var m
        if (uri === '/midi-learn') return { type: 'midi', kind: 'MIDI', label: 'Learning…', locked: locked }
        if ((m = /^\/midi-custom_Ch\.(\d+)_CC#(\d+)/.exec(uri))) return { type: 'midi', kind: 'MIDI', label: 'CC ' + m[2] + ' · Ch ' + m[1], locked: locked }
        if ((m = /^\/midi-custom_Ch\.(\d+)_Pbend/.exec(uri))) return { type: 'midi', kind: 'MIDI', label: 'Pitchbend · Ch ' + m[1], locked: locked }
        if (uri === '/bpm') return { type: 'midi', kind: 'Tempo', label: 'BPM', locked: locked }
        var actuator = null
        ;(window.HARDWARE_PROFILE || []).forEach(function (a) { if (a.uri === uri) actuator = a })
        var name = data.label || (actuator && actuator.name) || uri
        if (uri.indexOf('/cv') === 0) return { type: 'cv', kind: 'CV', label: actuator ? actuator.name : uri.replace(/^\/cv\/(graph\/)?/, ''), locked: locked }
        if (uri.indexOf('/hmi') === 0) return { type: 'device', kind: 'Device', label: (actuator && actuator.name) || name, locked: locked }
        return { type: 'chain', kind: 'Control Chain', label: (actuator && actuator.name) || name, locked: locked }
    }

    // MOD's binding (addressing) dialog for a port, ':bypass' or ':presets'
    mod.openAddressing = function (instance, symbol) {
        var gui = mod.gui(instance), icon = mod.plugins()[instance]
        var hw = mod.pedalboard().data('hardwareManager')
        if (gui && hw && gui.controls[symbol]) hw.open(instance, gui.controls[symbol], icon && icon.data('label'))
    }

    // plugin on/off: MOD's ':bypass' port is the inverse (1 = bypassed)
    mod.pluginOn = function (instance) {
        var gui = mod.gui(instance)
        return gui ? !(gui.controls[':bypass'] && gui.controls[':bypass'].value) : true
    }
    mod.setPluginOn = function (instance, on) { mod.setPortValue(instance, ':bypass', on ? 0 : 1) }

    // presets, read from MOD's own preset elements (they follow saves,
    // renames and deletes), and the current one
    var presetBox = function (instance) {
        var gui = mod.gui(instance)
        return gui && gui.settings ? gui.settings.find('.mod-presets') : $()
    }
    mod.presets = function (instance) {
        var box = presetBox(instance), gui = mod.gui(instance)
        var read = function (sel) {
            return box.find(sel + ' [mod-role=enumeration-option]').map(function () {
                return { id: $(this).attr('mod-uri'), name: $(this).text() }
            }).get()
        }
        return { factory: read('.mod-preset-factory'), user: read('.mod-preset-user'), selected: gui ? gui.currentPreset : null, enabled: box.data('enabled') !== false }
    }
    mod.presetAction = function (instance, action, id) {
        var box = presetBox(instance)
        if (action === 'load') { box.find('[mod-role=enumeration-option][mod-uri="' + id + '"]').click(); return }
        var btn = { saveAs: '.preset-btn-save-as', save: '.preset-btn-save', rename: '.preset-btn-rename', delete: '.preset-btn-delete' }[action]
        if (btn) box.find(btn).click()
    }
    mod.onPresetsChange = function (instance, cb) {
        hook(instance, 'selectPreset', function () { cb() })
        var box = presetBox(instance)[0]
        if (box && window.MutationObserver) new MutationObserver(function () { cb() }).observe(box, { childList: true, subtree: true, characterData: true })
    }
})();
