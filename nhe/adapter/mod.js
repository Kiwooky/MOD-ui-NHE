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
            name: e.name, brand: e.brand, uri: e.uri,
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

    // The NHE addressing dialog's model (components/controls/addressing.js).
    // It opens MOD's own addressing form (hardware.js open(), the template
    // include/addressing.html) hidden, reads what MOD shows in it and sets its
    // fields, and Save presses MOD's Save: MOD's checks, defaults and saving
    // (saveAddressing / addressNow) run unchanged. Depends on that form's
    // markup: .js-type buttons (data-value), .device-table td (selected /
    // disabled), select[name=cc-actuator|cv-port|steps|led-color-mode|
    // momentary-sw-mode|cv-op-mode|divider], input[name=label|min|max|tempo],
    // the .dynamic-field messages, .range / .tempo groups, .js-save / .js-close.
    mod.addressing = function (instance, symbol) {
        var gui = mod.gui(instance), icon = mod.plugins()[instance]
        var hw = mod.pedalboard().data('hardwareManager')
        var port = gui && gui.controls[symbol]
        if (!hw || !port) return null
        var pluginLabel = (icon && icon.data('label')) || ''
        hw.open(instance, port, pluginLabel)
        var form = $('body > .mod-pedal-settings-address').last()
        if (!form.length) return null
        form.addClass('nhe-hidden-form')
        var root = form[0]

        // shown in MOD's form: no hidden group between the element and the
        // form (the "Advanced" box counts as open: NHE shows those directly)
        var shown = function (el) {
            for (var n = el && el[0] || el; n && n !== root; n = n.parentNode) {
                if (n.classList && n.classList.contains('advanced-container')) continue
                if (n.style && n.style.display === 'none') return false
            }
            return !!n
        }
        var text = function (el) { return $.trim($(el).text()).replace(/\s+/g, ' ') }
        var optionsOf = function (sel) {
            return sel.find('option').map(function () { return { label: text(this), value: this.value } }).get()
        }
        var CV_RANGE = { '-': '−10 – 0 V', 'b': '±5 V', '+': '0 – +10 V' }   // MOD's labels are sentences
        var SETTINGS = [['steps', 'Sensitivity'], ['momentary-sw-mode', 'Mode'], ['led-color-mode', 'LED colour'], ['cv-op-mode', 'CV range']]

        var model = {
            state: function () {
                // MOD Desktop marks Device and Control Chain 'desktop-app-locked':
                // picking one shows its upsell card and leaves the type input alone
                var picked = form.find('.js-type.selected')
                var locked = picked.hasClass('desktop-app-locked')
                var type = locked ? picked.attr('data-value') : form.find('input[name=type]').val()
                var types = form.find('.js-type').filter(function () { return this.style.display !== 'none' })
                    .map(function () { return { id: $(this).attr('data-value'), label: text(this) } }).get()

                var targets = null, message = ''
                var cells = form.find('.device-table td')
                if (shown(form.find('.device-table')) && cells.length) {
                    targets = cells.map(function (i) {
                        var c = $(this), page = c.attr('data-page'), label = text(this)
                        if (page !== undefined) label += ' · Page ' + (Number(page) + 1)
                        return { id: 'td:' + i, label: label, selected: c.hasClass('selected'), disabled: c.hasClass('disabled') }
                    }).get()
                } else {
                    ;['cc-actuator', 'cv-port'].forEach(function (name) {
                        var sel = form.find('select[name=' + name + ']')
                        if (targets || !shown(sel) || !sel.find('option').length) return
                        targets = optionsOf(sel).map(function (op) { return { id: name + ':' + op.value, label: op.label, selected: op.value === sel.val() } })
                    })
                }
                if (locked) {
                    targets = null
                    message = 'Only on a MOD device: assign this control to a knob or footswitch on a Duo, Duo X or Dwarf.'
                } else if (!targets) {
                    form.find('span.dynamic-field').each(function () { if (shown(this)) message = text(this) })
                    if (!message && type !== 'null') message = 'Nothing available to assign this control to.'
                }

                var settings = []
                SETTINGS.forEach(function (s) {
                    var sel = form.find('select[name=' + s[0] + ']')
                    var opts = optionsOf(sel)
                    if (!shown(sel.closest('.form-group')) || sel.hasClass('disabled') || opts.length < 2) return
                    if (s[0] === 'cv-op-mode') opts.forEach(function (op) { op.label = CV_RANGE[op.value] || op.label })
                    settings.push({ id: s[0], title: s[1], options: opts, value: sel.val(), disabled: sel.prop('disabled') })
                })

                var tempo = null, tg = form.find('.tempo')
                if (tg.length && shown(tg) && tg[0].style.display !== 'none') {
                    var dv = form.find('select[name=divider]')
                    tempo = { on: form.find('input[name=tempo]').prop('checked'), dividers: optionsOf(dv), divider: dv.val() }
                }

                return {
                    types: types, type: type, targets: targets, message: message,
                    label: form.find('input[name=label]').val(),
                    min: form.find('input[name=min]').val(), max: form.find('input[name=max]').val(),
                    range: shown(form.find('.range')),
                    settings: settings, tempo: tempo,
                    canSave: !locked && !form.find('.js-save').hasClass('disabled')
                }
            },
            setType: function (id) { form.find('.js-type').filter(function () { return $(this).attr('data-value') === id }).click() },
            setTarget: function (id) {
                var m = /^td:(\d+)$/.exec(id)
                if (m) { form.find('.device-table td').eq(Number(m[1])).click(); return }
                var i = id.indexOf(':')
                form.find('select[name=' + id.slice(0, i) + ']').val(id.slice(i + 1)).change()
            },
            setSetting: function (name, value) { form.find('select[name=' + name + ']').val(value).change() },
            setTempo: function (on) { form.find('input[name=tempo]').prop('checked', !!on).change() },
            setDivider: function (value) { form.find('select[name=divider]').val(value).change() },
            save: function (v) {
                form.find('input[name=label]').val(v.label)
                if (v.min !== undefined) { form.find('input[name=min]').val(v.min); form.find('input[name=max]').val(v.max) }
                form.find('.js-save').click()
            },
            // MOD's Cancel removes its form
            cancel: function () { form.find('.js-close').first().click(); form.remove() }
        }
        var control = symbol === ':bypass' ? 'On/off' : symbol === ':presets' ? 'Presets' : (port.shortName || port.name || symbol)
        return { model: model, plugin: pluginLabel, control: control }
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

    // ------------------------------------------------------------------
    // System bar: stats, tempo, signal chain
    //
    // Stats are read from MOD's own status bar elements (#cpu-bar-text,
    // #ram-bar-text, #mod-xruns), which host.js updates from the websocket's
    // "stats" / "sys_stats". Tempo is desktop.transportControls (transport.js)
    // plus the websocket's "transport-bpm" (the global `ws`). Connections come
    // from the pedalboard's connectionManager (pedalboard.js): origIndex /
    // destIndex keyed by port paths like /graph/<plugin>/<symbol>; the device's
    // own jacks are /graph/capture_N, /graph/playback_N, MIDI and CV ports.

    // null when MOD has no figure (MOD Desktop shows "RAM NaN%")
    var number = function (text) { var m = /([\d.]+)/.exec(text || ''); return m ? parseFloat(m[1]) : null }

    mod.stats = function () {
        return { cpu: number($('#cpu-bar-text').text()), ram: number($('#ram-bar-text').text()), xruns: number($('#mod-xruns').text()) }
    }

    mod.onStats = function (cb) {
        if (!window.MutationObserver) return
        var fire = function () { cb(mod.stats()) }
        ;['#cpu-bar-text', '#ram-bar-text', '#mod-xruns'].forEach(function (sel) {
            var el = $(sel)[0]
            if (el) new MutationObserver(fire).observe(el, { childList: true, characterData: true, subtree: true })
        })
    }

    var syncMode = function () { return $('[mod-sync-mode].selected').attr('mod-sync-mode') || 'none' }
    var SYNC_NAMES = { midi_clock_slave: 'MIDI clock', link: 'Ableton Link' }

    // { bpm, locked, sync }: locked while slaved to MIDI clock (MOD greys its knob then)
    mod.tempo = function () {
        var t = desktop && desktop.transportControls
        var mode = syncMode()
        return { bpm: t && t.beatsPerMinutePort ? t.beatsPerMinutePort.value : 120, locked: mode === 'midi_clock_slave', sync: SYNC_NAMES[mode] || '' }
    }

    mod.setTempo = function (bpm) {
        var t = desktop && desktop.transportControls
        if (!t || !window.ws) return
        ws.send('transport-bpm ' + bpm)
        t.setBeatsPerMinuteValue(bpm, true, true)
    }

    mod.onTempo = function (cb) {
        var t = desktop && desktop.transportControls
        if (!t || t.__nheTempo) return
        t.__nheTempo = []
        ;['setBeatsPerMinuteValue', 'setSyncMode'].forEach(function (m) {
            var original = t[m]
            t[m] = function () { var r = original.apply(this, arguments); t.__nheTempo.forEach(function (fn) { fn(mod.tempo()) }); return r }
        })
        t.__nheTempo.push(cb)
    }

    // the plugins and device jacks directly connected to a plugin, per port:
    // { inputs: [{ port, items: [{ id, brand, name } | { device: true }] }], outputs: [...] }
    mod.neighbours = function (instance) {
        var gui = mod.gui(instance), cm = mod.pedalboard().data('connectionManager')
        if (!gui || !cm) return { inputs: [], outputs: [] }
        var plugins = mod.plugins()
        var owner = function (path) {
            for (var i in plugins) if (path.indexOf(i + '/') === 0) return i
            return null
        }
        var describe = function (path) {
            var i = owner(path)
            if (!i) return { device: true }
            var g = mod.gui(i), e = (g && g.effect) || {}
            return { id: i, brand: e.brand || '', name: (plugins[i].data('label')) || e.label || e.name || i }
        }
        var side = function (dir, index) {
            var out = []
            ;['audio', 'cv', 'midi'].forEach(function (type) {
                var ports = (gui.effect.ports[type] && gui.effect.ports[type][dir]) || []
                ports.forEach(function (p) {
                    var path = instance + '/' + p.symbol
                    var seen = {}, items = []
                    Object.keys(index[path] || {}).forEach(function (other) {
                        var d = describe(other), key = d.device ? 'device' : d.id
                        if (!seen[key]) { seen[key] = true; items.push(d) }
                    })
                    out.push({ port: p.name || p.symbol, items: items })
                })
            })
            return out
        }
        // ports wired to the same things share one heading: "In L/R"
        var merge = function (list) {
            var out = []
            list.forEach(function (p) {
                var key = p.items.map(function (i) { return i.device ? 'device' : i.id }).join('|')
                var prev = out[out.length - 1]
                if (prev && prev.key === key && key) {
                    prev.names.push(p.port)
                    // the shared start up to its last space: "In L", "In R" -> "In L/R";
                    // "Audio Input 1", "Audio Input 2" -> "Audio Input 1/2"
                    var first = prev.names[0], n = first.length
                    prev.names.forEach(function (name) { var i = 0; while (i < n && i < name.length && name[i] === first[i]) i++; n = i })
                    var cut = first.lastIndexOf(' ', n - 1) + 1
                    prev.port = cut > 0
                        ? first.slice(0, cut) + prev.names.map(function (name) { return name.slice(cut) }).join('/')
                        : prev.names.join(' / ')
                    return
                }
                out.push({ port: p.port, items: p.items, key: key, names: [p.port] })
            })
            return out.map(function (p) { return { port: p.port, items: p.items } })
        }
        return { inputs: merge(side('input', cm.destIndex)), outputs: merge(side('output', cm.origIndex)) }
    }

    mod.openSettings = function (instance) {
        var icon = mod.plugins()[instance]
        var s = icon && icon.data('settings')
        if (s) s.window('open')
    }

    // ------------------------------------------------------------------
    // File parameters (NAM models, IRs…): MOD's file lists
    //
    // Read from MOD's own (hidden) file list (.mod-file-list, the
    // customSelectPath widget in modgui.js) and act by clicking its rows, so
    // MOD keeps doing the folder navigation and setting the parameter. Rows:
    // "dir://<path>" is a folder (with icon-folder-up: the open folder, a tap
    // goes up), "t3k://…" is MOD's Tone3000 entry, anything else a file.

    var fileBoxes = function (instance) {
        var gui = mod.gui(instance)
        return gui && gui.settings ? gui.settings.find('.mod-file-list') : $()
    }

    mod.fileLists = function (instance) {
        return fileBoxes(instance).map(function () {
            var box = $(this), list = box.find('.mod-enumerated-list')
            var items = list.find('[mod-role=enumeration-option]').filter(':not(.mod-hidden)').map(function () {
                var el = $(this), v = el.attr('mod-parameter-value') || ''
                if (v.indexOf('t3k://') === 0) return null
                var kind = v.indexOf('dir://') === 0 ? (el.find('.icon-folder-up').length ? 'up' : 'folder') : 'file'
                return { kind: kind, name: el.attr('title') || el.text().trim(), value: v, selected: el.hasClass('selected') }
            }).get()
            return { uri: list.attr('mod-parameter-uri'), label: box.find('.mod-enumerated-title').first().text().trim(), items: items, t3k: box.find('.file-list-btn-t3k').length > 0 }
        }).get()
    }

    mod.fileAction = function (instance, uri, value) {
        fileBoxes(instance).find('.mod-enumerated-list').filter(function () { return $(this).attr('mod-parameter-uri') === uri })
            .find('[mod-role=enumeration-option]').filter(function () { return $(this).attr('mod-parameter-value') === value }).first().click()
    }

    mod.fileT3K = function (instance, uri) {
        fileBoxes(instance).find('.file-list-btn-t3k').filter(function () { return $(this).attr('mod-parameter-uri') === uri }).first().click()
    }

    mod.onFilesChange = function (instance, cb) {
        if (!window.MutationObserver) return
        fileBoxes(instance).each(function () {
            new MutationObserver(function () { cb() }).observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
        })
    }
})();
