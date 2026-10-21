// SPDX-FileCopyrightText: 2026 New Horizon Electronics
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
    // view), set  mod.pedalboard().data('performanceMode', true)  (or borrow
    // one with mod.borrowIcon, below) and:
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
            if (self.data && (self.data('performanceMode') || lent())) {
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

    // One plugin's working icon (its modgui), borrowed off MOD's canvas to
    // show and play somewhere else (the constructor's focused face). It keeps
    // working: modgui's widgets talk to the host through the icon's own
    // callbacks, and host updates reach it through the guard above. While it
    // is away MOD's canvas layout pauses (guard), its jQuery UI draggable /
    // droppable are off (else it could be dragged around in its new home),
    // and its canvas position is kept here: the icon's CSS left / top are
    // overridden where it's shown. Gone back to the canvas some other way
    // (the performance view returns every icon it took to the canvas), it
    // counts as returned.
    var borrowed = {}       // instance -> { x, y }: its place on MOD's canvas
    var onCanvas = function (icon) { return $.contains(mod.pedalboard()[0], icon[0]) }
    var lent = function () {
        var plugins = mod.plugins(), any = false
        Object.keys(borrowed).forEach(function (i) {
            var icon = plugins[i]
            if (icon && icon[0] && !onCanvas(icon)) any = true
            else delete borrowed[i]
        })
        return any
    }
    var dnd = function (icon, how) {
        if (icon.data('ui-draggable') || icon.data('draggable')) icon.draggable(how)
        if (icon.data('ui-droppable') || icon.data('droppable')) icon.droppable(how)
    }
    // the icon (jQuery), to be appended elsewhere, or null
    mod.borrowIcon = function (instance) {
        var icon = mod.plugins()[instance]
        if (!icon || !icon.data || !icon.data('gui')) return null
        mod.guardPedalboard()
        if (!borrowed[instance] && onCanvas(icon)) {
            borrowed[instance] = { x: parseFloat(icon.css('left')) || 0, y: parseFloat(icon.css('top')) || 0 }
            dnd(icon, 'disable')
        }
        return icon
    }
    mod.returnIcon = function (instance) {
        var icon = mod.plugins()[instance], pos = borrowed[instance], pb = mod.pedalboard()
        delete borrowed[instance]
        if (!icon || !icon.data || !pos || onCanvas(icon)) return
        dnd(icon, 'enable')
        icon.css({ left: pos.x, top: pos.y }).appendTo(pb)
        pb.pedalboard('drawPluginJacks', icon)
        if (!lent() && !pb.data('performanceMode') && pb.data('performancePendingFit')) {
            pb.data('performancePendingFit', false)
            pb.pedalboard('fitToWindow')
        }
    }
    // modgui's controls in an icon: a press there plays it, everywhere else
    // (the pedal's inactive surface) it pans or lifts the pedal. A control is
    // anything inside an element with a mod-role other than the background
    // (the drag handle) and the bypass light, a form field, or, for GUIs
    // that wire up their own widgets in their javascript, any element
    // (between the target and the drag handle) whose pointer says it can be
    // clicked or dragged
    var GRABBY = /^(pointer|grab|grabbing|move|ns-resize|ew-resize|n-resize|s-resize|e-resize|w-resize|row-resize|col-resize|all-scroll)$/
    mod.isIconControl = function (target) {
        var r = $(target).closest('[mod-role], select, input, textarea, button')
        var role = r.attr('mod-role')
        if (r.length && role !== 'drag-handle' && role !== 'bypass-light') return true
        for (var n = target; n && n.nodeType === 1; n = n.parentNode) {
            if (n.getAttribute('mod-role') === 'drag-handle' || (n.classList && (n.classList.contains('mod-drag-handle') || n.classList.contains('mod-pedal')))) return false
            // its own cursor, not one inherited from the pedal around it
            var c = getComputedStyle(n).cursor, up = n.parentNode && n.parentNode.nodeType === 1 ? getComputedStyle(n.parentNode).cursor : ''
            if (GRABBY.test(c) && c !== up) return true
        }
        return false
    }
    // modgui's own click on a drag handle zooms MOD's canvas to it (pedalboard.js
    // addPlugin's click option, .mod-drag-handle): not wanted from elsewhere
    mod.isIconBackground = function (target) {
        return $(target).closest('[mod-role]').attr('mod-role') === 'drag-handle' || $(target).hasClass('mod-drag-handle')
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

    mod.onSettingsClose = function (cb) {
        $('body').on('windowclose', '.mod-settings', function (e) {
            if (e.target !== this) return
            var instance = $(this).attr('mod-instance')
            if (instance) cb(instance, $(this))
        })
    }

    // Full width on phones in landscape. MOD's page has no viewport tag, so a
    // phone keeps it out of the notch areas (black bars at both sides). While
    // an NHE screen shows, ask for viewport-fit=cover (its content keeps clear
    // of the notch with env(safe-area-inset-*)); when none shows, MOD's page
    // goes back to how it was. width=980 is the layout width phones use for a
    // page without the tag, so MOD's layout doesn't change.
    var bleeders = {}
    mod.fullBleed = function (owner, on) {
        if (on) bleeders[owner] = true
        else delete bleeders[owner]
        var want = Object.keys(bleeders).length > 0
        var meta = document.querySelector('meta[name=viewport][data-nhe]')
        if (want && !meta && !document.querySelector('meta[name=viewport]')) {
            meta = document.createElement('meta')
            meta.name = 'viewport'
            meta.setAttribute('data-nhe', '')
            meta.content = 'width=980, viewport-fit=cover'
            document.head.appendChild(meta)
        } else if (!want && meta) {
            meta.parentNode.removeChild(meta)
        }
    }

    // MOD's builder background: background.jpg on #pedalboard-dashboard
    // (css/dashboard.css: '#111 url(../img/background.jpg) repeat', sized
    // auto 1200px), which the performance view (#performance-view) shows
    // too. url: an image to use in its place, or null for MOD's own; height:
    // the tile's height in px (MOD's is 1200), else MOD's sizing stays.
    mod.setBackground = function (url, height) {
        var style = document.getElementById('nhe-background')
        if (!url) { if (style) style.parentNode.removeChild(style); return }
        if (!style) {
            style = document.createElement('style')
            style.id = 'nhe-background'
            document.head.appendChild(style)
        }
        var u = String(url).replace(/["\\\n]/g, '')
        var size = height ? ' background-size: auto ' + Math.round(height) + 'px !important; background-repeat: repeat !important;' : ''
        style.textContent = '#pedalboard-dashboard, #performance-view { background-image: url("' + u + '") !important;' + size + ' }'
    }

    // MOD's own wood (css/dashboard.css: img/background.jpg, tiled 1200 px
    // tall), for NHE's builder when SET → Work surface is MOD's
    mod.builderWood = function () { return { url: '/img/background.jpg', height: 1200 } }

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
            gui: e.gui || {},
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

    // Wrap a GUI method once, calling every listener after MOD's own code.
    // The listeners live on the GUI object itself, not under the instance
    // name: reloading a pedalboard, or updating a plugin, gives the same
    // instance name a new GUI, and that one has to be wrapped too (keyed by
    // name, the new GUI went unwrapped and NHE stopped following MOD).
    var hook = function (instance, method, cb) {
        var gui = mod.gui(instance)
        if (!gui) return
        var all = Object.prototype.hasOwnProperty.call(gui, '__nheListeners') ? gui.__nheListeners : (gui.__nheListeners = {})
        if (!all[method]) {
            var list = all[method] = []
            var original = gui[method]
            gui[method] = function () {
                var r = original.apply(this, arguments)
                var args = arguments
                list.forEach(function (fn) { try { fn.apply(null, args) } catch (err) { if (window.console) console.error(err) } })
                return r
            }
        }
        all[method].push(cb)
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
    // askName (optional): fn({ title, name }, done(newName)) replaces MOD's
    // name window for Save as and Rename. MOD's buttons ask for the name
    // through desktop.openPresetSaveWindow(title, name, callback)
    // (desktop.js); that is swapped for the one click, so MOD's checks and
    // saving (presetSaveNew / presetSaveReplace) run unchanged.
    mod.presetAction = function (instance, action, id, askName) {
        var box = presetBox(instance)
        if (action === 'load') { box.find('[mod-role=enumeration-option][mod-uri="' + id + '"]').click(); return }
        var btn = { saveAs: '.preset-btn-save-as', save: '.preset-btn-save', rename: '.preset-btn-rename', delete: '.preset-btn-delete' }[action]
        if (!btn) return
        var named = (action === 'saveAs' || action === 'rename') && typeof askName === 'function' && window.desktop
        if (!named) { box.find(btn).click(); return }
        var own = desktop.hasOwnProperty('openPresetSaveWindow'), orig = desktop.openPresetSaveWindow
        var restore = function () { if (own) desktop.openPresetSaveWindow = orig; else delete desktop.openPresetSaveWindow }
        desktop.openPresetSaveWindow = function (title, name, callback) {
            restore()
            askName({ title: title, name: name }, callback)
        }
        try { box.find(btn).click() } finally { restore() }
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
        if (!t) return
        // wrapped once; every caller's listener joins the list
        if (!t.__nheTempo) {
            t.__nheTempo = []
            ;['setBeatsPerMinuteValue', 'setSyncMode', 'setPlaybackState'].forEach(function (m) {
                var original = t[m]
                if (!original) return
                t[m] = function () { var r = original.apply(this, arguments); t.__nheTempo.forEach(function (fn) { fn(mod.tempo()) }); return r }
            })
        }
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

    // ------------------------------------------------------------------
    // The board, for NHE's constructor (features/constructor)
    //
    // Reading: the plugin icons in pedalboard.data('plugins') (instance ->
    // icon; position in the icon's CSS left / top, in canvas px; its GUI's
    // effect.ports for the ports, named instance + '/' + symbol as in
    // mod-port), MOD's own ports in pedalboard.data('hwOutputs') (sources:
    // capture, MIDI in) and data('hwInputs') (destinations: playback, MIDI
    // out), each a jQuery element with mod-port, title and data('portType'),
    // and the connections in the connectionManager's origIndex
    // (origIndex[from][to] = jack).
    //
    // Following: the websocket (the global `ws`, host.js) carries "add",
    // "remove", "connect", "disconnect", "plugin_pos", "add_hw_port",
    // "remove_hw_port", "loading_start" / "loading_end" to every browser,
    // this one included; a listener is added beside MOD's ws.onmessage.
    // An added plugin's icon only appears after MOD fetches its data, so
    // the pedalboard element's children are watched too.
    //
    // Writing goes through the functions MOD's builder itself calls, kept
    // on the pedalboard element by desktop.js makePedalboard: data('portConnect')
    // (GET /effect/connect/<from>,<to>), data('portDisconnect')
    // (/effect/disconnect/), data('pluginLoad') (/effect/add/<instance>?x&y&uri)
    // with pedalboard('generateInstance') and data('wait') (the loading
    // placeholder), and data('pluginMove') (ws "plugin_pos", marks the board
    // modified). The host answers connect / disconnect / add over the
    // websocket, which is what draws them on MOD's canvas, so MOD stays the
    // source of truth and NHE follows it like any other browser.

    var BOARD_CMDS = { add: 1, remove: 1, connect: 1, disconnect: 1, plugin_pos: 1, add_hw_port: 1, remove_hw_port: 1, loading_start: 1, loading_end: 1 }

    // true while MOD loads a pedalboard: host.js's pb_loading, or MOD's
    // "Loading pedalboard…" blocker (.screen-loading, desktop.js), which
    // stays up after loading_end until the icons are drawn. Plugins and
    // connections arrive one by one then, in no particular order, and the
    // icons' sizes settle late
    mod.boardLoading = function () { return window.pb_loading === true || $('.screen-loading').is(':visible') }

    // which board: its bundle path ('' for an unsaved one) and title
    mod.boardId = function () { return (window.desktop && desktop.pedalboardBundle) || '' }
    mod.boardTitle = function () { return (window.desktop && desktop.title) || '' }

    // MOD's own ports, as NHE names them: Audio In / Out (L) / (R) for the
    // first two capture / playback ports, else MOD's title without "Hardware"
    var systemName = function (port, title, source) {
        var m = /\/(capture|playback)_([12])$/.exec(port)
        if (m) {
            var side = m[2] === '1' ? 'L' : 'R'
            return { name: 'Audio ' + (source ? 'In' : 'Out') + ' (' + side + ')', short: (source ? 'In' : 'Out') + ' (' + side + ')', channel: side }
        }
        return { name: String(title || port.split('/').pop()).replace(/^Hardware /, '') }
    }

    // Where a plugin's jacks are on its face: { portId: { x, y } }, fractions
    // of the icon's box, measured from modgui's jack elements ([mod-port]
    // with mod-role input-/output-audio|midi|cv-port; MOD draws its cables
    // to them). x is the jack's edge against the pedal (inputs: its right
    // edge, outputs: its left), y its middle. Measured while the icon is
    // drawn (on MOD's canvas, at any zoom); kept per GUI, so a borrowed icon
    // (its jacks hidden) keeps them.
    var jacksOf = function (icon, gui) {
        if (gui.__nheJacks) return gui.__nheJacks
        var R = icon[0].getBoundingClientRect(), out = {}, n = 0
        if (!R.width || !R.height) return null
        icon.find('[mod-role$="-audio-port"], [mod-role$="-midi-port"], [mod-role$="-cv-port"]').each(function () {
            var port = this.getAttribute('mod-port'), role = this.getAttribute('mod-role') || '', r = this.getBoundingClientRect()
            if (!port || !r.width || !r.height) return
            var x = role.indexOf('input') === 0 ? r.right : r.left
            out[port] = { x: (x - R.left) / R.width, y: (r.top + r.height / 2 - R.top) / R.height }
            n++
        })
        if (!n) return null
        return (gui.__nheJacks = out)
    }

    // { pedals: [{ instance, uri, name, brand, x, y, w, h, ports, jacks }],
    //   system: [{ port, name, short, channel, type, source }],
    //   connections: [[fromPort, toPort]] }
    // ports: { audio: { in: [portId], out: [portId] }, midi, cv }; a pedal
    // whose icon isn't drawn yet (just added) is left out until it is
    mod.board = function () {
        var pb = mod.pedalboard(), plugins = mod.plugins(), out = { pedals: [], system: [], connections: [] }
        Object.keys(plugins).forEach(function (instance) {
            var icon = plugins[instance], gui = icon && icon.data && icon.data('gui')
            if (!gui || !icon.position) return
            var e = gui.effect || {}, ports = {}
            ;['audio', 'midi', 'cv'].forEach(function (t) {
                var p = (e.ports && e.ports[t]) || {}
                ports[t] = {
                    in: (p.input || []).map(function (q) { return instance + '/' + q.symbol }),
                    out: (p.output || []).map(function (q) { return instance + '/' + q.symbol })
                }
            })
            out.pedals.push({
                instance: instance, uri: e.uri, gui: e.gui || {},
                name: icon.data('label') || e.label || e.name || instance, brand: e.brand || '',
                // borrowed: where it is on MOD's canvas, not where it's shown
                x: borrowed[instance] && !onCanvas(icon) ? borrowed[instance].x : parseFloat(icon.css('left')) || 0,
                y: borrowed[instance] && !onCanvas(icon) ? borrowed[instance].y : parseFloat(icon.css('top')) || 0,
                w: icon.outerWidth() || 0, h: icon.outerHeight() || 0,
                ports: ports,
                jacks: jacksOf(icon, gui)
            })
        })
        var hw = function (list, source) {
            ;(list || []).forEach(function (el) {
                var port = el.attr('mod-port')
                if (!port) return
                var n = systemName(port, el.attr('title'), source)
                out.system.push({ port: port, name: n.name, short: n.short, channel: n.channel, type: el.data('portType') || 'audio', source: source, index: parseInt(el.attr('mod-port-index'), 10) || 0 })
            })
        }
        hw(pb.data('hwOutputs'), true)
        hw(pb.data('hwInputs'), false)
        var cm = pb.data('connectionManager')
        if (cm) Object.keys(cm.origIndex).forEach(function (from) {
            Object.keys(cm.origIndex[from] || {}).forEach(function (to) { out.connections.push([from, to]) })
        })
        return out
    }

    // cb(reloaded) whenever the board may have changed (debounced); not
    // while MOD is loading a pedalboard, but once when it's done. reloaded:
    // another board was loaded (or a new one started) since the last call
    mod.onBoardChange = function (cb) {
        var timer = null, reloaded = false
        var later = function () {
            clearTimeout(timer)
            timer = setTimeout(function () {
                if (mod.boardLoading()) { later(); return }   // again once MOD is done
                var r = reloaded
                reloaded = false
                cb(r)
            }, 80)
        }
        var socket = window.ws
        if (socket && socket.addEventListener) {
            socket.addEventListener('message', function (evt) {
                var data = String(evt.data), cmd = data.split(' ', 1)[0]
                if (!BOARD_CMDS[cmd]) return
                if (cmd === 'loading_start' || data === 'remove :all') reloaded = true
                later()
            })
        }
        if (window.MutationObserver) new MutationObserver(later).observe(mod.pedalboard()[0], { childList: true })
    }

    var plugsUrl = function (path, a, b) { return '/effect/' + path + '/' + a + ',' + b }

    // ------------------------------------------------------------------
    // MOD's top and bottom bars, for NHE's own (features/bars)
    //
    // NHE's bars drive MOD's: each item clicks MOD's own button or icon
    // (index.html #pedalboard-actions and #main-menu; desktop.js binds their
    // clicks), so MOD's dialogs, checks and upsells run unchanged. MOD's
    // bars stay in the page, hidden (mod.coverMenus); NHE's are mounted in
    // them (mod.mountMenus), so they stack as MOD's do.
    var BAR = {
        // top bar (#pedalboard-info)
        'new': '#pedalboard-info .js-reset', save: '#pedalboard-info .js-save', saveAs: '#pedalboard-info .js-save-as',
        share: '#pedalboard-info .js-cloud', cv: '#pedalboard-info .js-cv-addressing',
        snapshotSave: '#pedalboard-info .js-preset-save', snapshotSaveAs: '#pedalboard-info .js-preset-save-as',
        snapshotManage: '#pedalboard-info .js-preset-manage',
        // bottom bar (#main-menu)
        constructor: '#mod-plugins', performance: '#mod-performance', library: '#mod-pedalboard', banks: '#mod-bank',
        files: '#mod-file-manager', store: '#mod-cloud-plugins', report: '#mod-report', tempo: '#mod-transport-icon',
        bypass1: '#mod-bypassLeft', bypass2: '#mod-bypassRight', midiPorts: '#mod-show-midi-port',
        settings: '#mod-settings', devices: '#mod-devices', update: '#mod-update'
    }
    var barEl = function (name) { return BAR[name] ? $(BAR[name]).first() : $() }
    mod.menuAction = function (name) { barEl(name).click() }
    // { shown, selected, greyed, modified, text } of one of MOD's bar items:
    // shown when MOD shows it (not .mod-hidden, not display: none); greyed:
    // MOD Desktop's locked items (desktop-app-greyed: a tap shows MOD's notice)
    mod.menuItem = function (name) {
        var e = barEl(name)
        if (!e.length) return { shown: false }
        var shown = !e.hasClass('mod-hidden') && e.css('display') !== 'none' && (!e[0].style || e[0].style.display !== 'none')
        return {
            shown: shown, selected: e.hasClass('selected'), greyed: e.hasClass('desktop-app-greyed'),
            modified: e.hasClass('unmodified-changes'), on: !e.hasClass('bypassed'),
            text: $.trim(e.text())
        }
    }
    // cb() when any of MOD's bar items changes (selected, shown, its text)
    mod.onMenusChange = function (cb) {
        if (!window.MutationObserver) return
        var timer = null
        var later = function () { clearTimeout(timer); timer = setTimeout(cb, 30) }
        ;['#pedalboard-actions', '#main-menu'].forEach(function (sel) {
            var el = $(sel)[0]
            if (el) new MutationObserver(later).observe(el, { subtree: true, attributes: true, attributeFilter: ['class', 'style'], childList: true, characterData: true })
        })
    }
    // NHE's bars in MOD's: top in #pedalboard-actions, bottom in #main-menu
    mod.mountMenus = function (top, bottom) {
        $(top).appendTo('#pedalboard-actions')
        $(bottom).appendTo('#main-menu')
    }
    // MOD's own bar contents hidden (NHE's, .nhe-menus, stay visible)
    mod.coverMenus = function (on) {
        var style = document.getElementById('nhe-cover-menus')
        if (on && !style) {
            style = document.createElement('style')
            style.id = 'nhe-cover-menus'
            style.textContent = '#pedalboard-actions > :not(.nhe-menus), #main-menu > :not(.nhe-menus) { visibility: hidden !important; }' +
                '#pedalboard-actions, #main-menu { background-image: none !important; }' +
                // NHE's drop-down panels and snapshot chips hang below the top bar: over
                // NHE's builder (z-index 5) and the performance view (6), under MOD's windows (1000+)
                '#pedalboard-actions { z-index: 8 !important; }'
            document.head.appendChild(style)
        } else if (!on && style) style.parentNode.removeChild(style)
    }

    // Save as with a name given in NHE (the bars' panels), through MOD's own
    // path: the button is clicked as usual, and the window MOD would open
    // for the name is answered at once instead.
    // The board: Save as calls desktop.saveCurrentPedalboard(true), which
    // asks desktop.saveBox.saveBox('save', …, asNew, callback) (desktop.js
    // JqueryClass 'saveBox'); NHE fills its input and sends it ('send'),
    // so MOD's checks, saving and notices run unchanged.
    mod.saveBoardAs = function (name) {
        var box = window.desktop && desktop.saveBox
        if (!box || !box.saveBox) { mod.menuAction('saveAs'); return }
        var own = Object.prototype.hasOwnProperty.call(box, 'saveBox'), orig = box.saveBox
        var restore = function () { if (own) box.saveBox = orig; else delete box.saveBox }
        box.saveBox = function (method, windowTitle, current, asNew, callback) {
            if (method !== 'save') return orig.apply(this, arguments)
            restore()
            box.find('input').val(name)
            box.data('asNew', asNew)
            box.data('callback', callback)
            return orig.call(box, 'send')
        }
        try { mod.menuAction('saveAs') } finally { restore() }
    }
    // a snapshot: Save snapshot as asks desktop.openPresetSaveWindow(title,
    // name, callback) for the name; that is answered with NHE's
    mod.saveSnapshotAs = function (name) {
        if (!window.desktop) return
        var own = Object.prototype.hasOwnProperty.call(desktop, 'openPresetSaveWindow'), orig = desktop.openPresetSaveWindow
        var restore = function () { if (own) desktop.openPresetSaveWindow = orig; else delete desktop.openPresetSaveWindow }
        desktop.openPresetSaveWindow = function (title, current, callback) { restore(); callback(name) }
        try { mod.menuAction('snapshotSaveAs') } finally { restore() }
    }
    // the snapshot's name now (desktop.pedalboardPresetName); the board's: mod.boardTitle
    mod.snapshotName = function () { return (window.desktop && desktop.pedalboardPresetName) || '' }

    // MOD's logo, as its top bar shows it (#pedalboard-actions' background)
    mod.logoUrl = function () { return '/img/icons/36/mod.png' }

    // the board's name with its snapshot, as MOD's title shows it
    // (desktop.titleBox: #pedalboard-info h1), and when it changes
    mod.boardName = function () { return $.trim($('#pedalboard-info h1').first().text()) }
    mod.onBoardName = function (cb) {
        var el = $('#pedalboard-info h1')[0]
        if (el && window.MutationObserver) new MutationObserver(function () { cb(mod.boardName()) }).observe(el, { childList: true, characterData: true, subtree: true })
    }

    // snapshots: the list (GET /snapshot/list: { index: name }) as
    // [{ id, name }], the current one (desktop.pedalboardPresetId), loading
    // one (GET /snapshot/load?id=, as snapshot.js does), and when they
    // change (ws "pedal_snapshot", "loading_end")
    mod.snapshots = function (cb) {
        $.ajax({
            url: '/snapshot/list', cache: false, dataType: 'json',
            success: function (r) {
                cb(Object.keys(r || {}).map(function (k) { return { id: parseInt(k, 10), name: r[k] } }).sort(function (a, b) { return a.id - b.id }))
            },
            error: function () { cb([]) }
        })
    }
    mod.snapshotCurrent = function () { return window.desktop ? desktop.pedalboardPresetId : null }
    mod.loadSnapshot = function (id, cb) {
        $.ajax({ url: '/snapshot/load', data: { id: id }, cache: false, success: function () { if (cb) cb(true) }, error: function () { mod.notify('error', 'Failed to load snapshot'); if (cb) cb(false) } })
    }
    mod.onSnapshots = function (cb) {
        var socket = window.ws, timer = null
        var later = function () { clearTimeout(timer); timer = setTimeout(cb, 120) }
        if (socket && socket.addEventListener) {
            socket.addEventListener('message', function (evt) {
                var cmd = String(evt.data).split(' ', 1)[0]
                if (cmd === 'pedal_snapshot' || cmd === 'loading_end') later()
            })
        }
        // renames and deletes in MOD's snapshot window (snapshot.js) send
        // nothing over the websocket: look again when that window closes
        var win = document.getElementById('pedal-presets-window')
        if (win && window.MutationObserver) new MutationObserver(function () { if (!$(win).is(':visible')) later() }).observe(win, { attributes: true, attributeFilter: ['style', 'class'] })
    }

    // the transport: rolling (desktop.transportControls' :rolling port), and
    // setting it as MOD's play button does (ws "transport-rolling", then
    // setPlaybackState: transport.js)
    mod.rolling = function () {
        var t = window.desktop && desktop.transportControls
        return !!(t && t.rollingPort && t.rollingPort.value > 0.5)
    }
    mod.setRolling = function (on) {
        var t = window.desktop && desktop.transportControls
        if (!t || !window.ws) return
        ws.send('transport-rolling ' + (on ? '1' : '0'))
        if (t.setPlaybackState) t.setPlaybackState(!!on, true, true)
    }

    // a message in MOD's own notification bar (notification.js: the global
    // Notification(type, message, timeout), which shadows the browser's)
    mod.notify = function (type, text, ms) {
        try { new window.Notification(type || 'error', text, ms || 5000) } catch (e) { if (window.console) console.warn('[nhe]', text) }
    }

    // connect / disconnect two ports (instance/symbol or MOD's /graph/... port);
    // cb(ok) when the host has answered
    mod.connect = function (from, to, cb) {
        var fn = mod.pedalboard().data('portConnect')
        if (fn) fn(from, to, function (ok) { if (cb) cb(!!ok) })
        else $.ajax({ url: plugsUrl('connect', from, to), cache: false, dataType: 'json', success: function (ok) { if (cb) cb(!!ok) } })
    }
    mod.disconnect = function (from, to, cb) {
        var pb = mod.pedalboard(), fn = pb.data('portDisconnect')
        var done = function () { pb.trigger('modified'); if (cb) cb(true) }   // MOD's own disconnect marks the board modified
        if (fn) fn(from, to, done)
        else $.ajax({ url: plugsUrl('disconnect', from, to), cache: false, dataType: 'json', success: done })
    }

    // add a plugin at x / y (canvas px); cb(instance) once the host has it
    // (its icon follows over the websocket), cb(null) if it failed (MOD
    // shows its own message)
    mod.addPlugin = function (uri, x, y, cb) {
        var pb = mod.pedalboard()
        var instance = pb.pedalboard('generateInstance', uri)
        var waiter = pb.data('wait'), load = pb.data('pluginLoad')
        if (!load) { if (cb) cb(null); return }
        x = Math.round(x)
        y = Math.round(y)
        if (waiter) waiter.startPlugin(instance, { x: x, y: y })
        load(uri, instance, x, y, function () {
            if (waiter) waiter.stopPlugin(instance, false)
            if (cb) cb(instance)
        }, function () {
            if (waiter) waiter.stopPlugin(instance, false)
            if (cb) cb(null)
        })
        return instance
    }

    // move a plugin to x / y (canvas px): its icon on MOD's canvas, and the
    // host (the ws doesn't send our own move back to us)
    mod.movePlugin = function (instance, x, y) {
        var pb = mod.pedalboard(), icon = mod.plugins()[instance]
        if (!icon || !icon.css) return
        x = Math.round(x)
        y = Math.round(y)
        if (borrowed[instance]) borrowed[instance] = { x: x, y: y }
        icon.css({ left: x, top: y })
        pb.pedalboard('drawPluginJacks', icon)
        var move = pb.data('pluginMove')
        if (move) move(instance, x, y)
    }

    // MOD's installed plugins (GET /effect/list), as its plugin bar has them:
    // [{ uri, name, brand, label, category: [..], iotype, ... }]
    var pluginList = null, listWaiting = []
    mod.pluginList = function (cb) {
        if (pluginList) { cb(pluginList); return }
        listWaiting.push(cb)
        if (listWaiting.length > 1) return
        $.ajax({
            url: '/effect/list', cache: false, dataType: 'json',
            success: function (list) { pluginList = list || []; listWaiting.splice(0).forEach(function (fn) { fn(pluginList) }) },
            error: function () { listWaiting.splice(0).forEach(function (fn) { fn([]) }) }
        })
    }

    // one plugin's full data (GET /effect/get): ports, author, licence…
    mod.pluginData = function (uri, cb) {
        $.ajax({ url: '/effect/get', data: { uri: uri, version: window.VERSION }, dataType: 'json', success: function (d) { cb(d || null) }, error: function () { cb(null) } })
    }

    // A plugin's ports and info page in NHE's shape (the + dialog's info,
    // a settings screen's info icon), from /effect/get:
    // cb({ ports: { audio: { in: [symbol], out }, midi, cv }, info: { comment,
    //      author, homepage, version, license, badge, screenshot, onlineHref,
    //      controls / cvInputs / cvOutputs: [{ name, default, minimum, maximum }] } })
    // or cb(null)
    mod.pluginDetails = function (uri, cb) {
        mod.pluginData(uri, function (d) {
            if (!d) { cb(null); return }
            var p = d.ports || {}, ports = {}
            ;['audio', 'midi', 'cv'].forEach(function (t) {
                var x = p[t] || {}
                ports[t] = { in: (x.input || []).map(function (q) { return q.symbol }), out: (x.output || []).map(function (q) { return q.symbol }) }
            })
            var ranges = function (list) {
                return (list || []).map(function (q) { var r = q.ranges || {}; return { name: q.shortName || q.name || q.symbol, 'default': r['default'], minimum: r.minimum, maximum: r.maximum } })
            }
            cb({
                ports: ports,
                info: {
                    comment: d.comment, author: d.author && d.author.name, homepage: d.author && d.author.homepage,
                    version: (d.minorVersion || 0) + '.' + (d.microVersion || 0) + '-' + (d.release || 0),
                    license: d.license,
                    badge: d.buildEnvironment !== 'prod' ? (d.buildEnvironment || 'local').toUpperCase() : '',
                    screenshot: mod.pluginImage(uri, 'screenshot'),
                    onlineHref: mod.pluginOnline(uri),
                    controls: ranges(p.control && p.control.input),
                    cvInputs: ranges(p.cv && p.cv.input),
                    cvOutputs: ranges(p.cv && p.cv.output)
                }
            })
        })
    }

    // remove a plugin, as MOD's own delete does: pedalboard('removePlugin',
    // instance, its ports) (GET /effect/remove/<instance>, and its CV outputs
    // off the hardware manager); its settings window closes first. The host
    // answers "disconnect" for each cable and "remove" over the websocket,
    // which takes it off MOD's canvas. cb() once the host has removed it
    mod.removePlugin = function (instance, cb) {
        var gui = mod.gui(instance), pb = mod.pedalboard()
        if (!gui) return
        mod.closeSettings(instance)
        if (borrowed[instance]) mod.returnIcon(instance)
        var ports = (gui.effect && gui.effect.ports) || {}
        var remove = pb.data('pluginRemove')
        if (!remove) { pb.pedalboard('removePlugin', instance, ports); return }
        // as pedalboard.js removePlugin, with our callback after MOD's own
        remove(instance, function () {
            var hw = pb.data('hardwareManager')
            ;((ports.cv && ports.cv.output) || []).forEach(function (o) { if (hw) hw.removeCvOutputPort('/cv' + instance + '/' + o.symbol) })
            if (cb) cb()
        })
    }

    // MOD's pictures of a plugin: 'thumbnail' or 'screenshot'
    // MOD's pictures of a plugin: 'thumbnail' or 'screenshot'. gui (optional):
    // the plugin's gui data (effect.gui, or a /effect/list entry's gui); one
    // without that picture gets MOD's plain can (resources/pedals/default.png,
    // its default icon's background) instead of MOD's own fallback, which
    // has "No interface available" written across it
    var PLAIN = '/resources/pedals/default.png'
    mod.pluginImage = function (uri, kind, gui) {
        kind = kind || 'thumbnail'
        if (gui && !gui[kind]) return PLAIN
        return '/effect/image/' + kind + '.png?uri=' + encodeURIComponent(uri)
    }
    // a picture that came back as MOD's fallback after all (the device can
    // list a gui whose files are missing): swap it for the plain can. MOD's
    // fallback (resources/pedals/default-screenshot.png) is 282 x 433
    mod.cleanPicture = function (img) {
        if (img && img.naturalWidth === 282 && img.naturalHeight === 433 && img.src.indexOf(PLAIN) < 0) img.src = PLAIN
    }

    // MOD's plugin page online (cloudplugin.js: PLUGINS_URL + '/' + btoa(uri))
    mod.pluginOnline = function (uri) {
        var base = window.PLUGINS_URL || 'https://pedalboards.mod.audio/plugins'
        try { return base + '/' + btoa(uri) } catch (e) { return base }
    }

    // MOD's favourites (the global FAVORITES, kept by effects.js) and the
    // same POST /favorites/add|remove its info window's star sends
    mod.isFavourite = function (uri) { return (window.FAVORITES || []).indexOf(uri) >= 0 }
    mod.setFavourite = function (uri, on, cb) {
        $.ajax({
            url: '/favorites/' + (on ? 'add' : 'remove'), type: 'POST', data: { uri: uri }, dataType: 'json', cache: false,
            success: function (ok) {
                var list = window.FAVORITES
                if (ok && list) {
                    var i = list.indexOf(uri)
                    if (on && i < 0) list.push(uri)
                    if (!on && i >= 0) list.splice(i, 1)
                }
                if (cb) cb(!!ok)
            }
        })
    }

    // While NHE's builder covers MOD's: MOD's zoom buttons and CV toggle
    // (#zoom-controllers, #js-cv-addressing-toggle, over the canvas) hide,
    // as the performance view does
    mod.coverBuilder = function (on) {
        var style = document.getElementById('nhe-cover-builder')
        if (on && !style) {
            style = document.createElement('style')
            style.id = 'nhe-cover-builder'
            style.textContent = '#zoom-controllers, #js-cv-addressing-toggle { visibility: hidden !important; }'
            document.head.appendChild(style)
        } else if (!on && style) style.parentNode.removeChild(style)
    }
})();
