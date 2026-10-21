// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Settings panel: MOD's plugin settings window shows the NHE settings screen
 * (system bar + panel: sliders, toggles, triggers, option lists, presets,
 * files, plugin on/off, stacking) instead of MOD's own controls. A NHE / MOD
 * switch in the window flips back to MOD's panel; the choice is remembered
 * in this browser.
 *
 * The same screen is the back of a pedal in the performance view:
 * NHE.settingsScreen.mount(instance, container, { exit, hop }) puts one in
 * any container (docs/performance-flip-spec.md).
 *
 * MOD's own controls stay in the window, hidden, so MOD's code keeps working.
 * Everything MOD-specific goes through NHE.mod (adapter/mod.js).
 * Specs: docs/slider-spec.md, docs/button-spec.md, docs/select-spec.md.
 */
NHE.register('settings', function (mod) {
    var VIEW_KEY = 'nhe-settings-view'     // 'nhe' | 'mod', per browser
    var TAB_KEY = 'nhe-system-bar-tab'     // 'meters' | 'chain', per browser
    var MINI_KEY = 'nhe-minimised'         // { 'instance/symbol': true }, per browser
    var COLOUR_KEY = 'nhe-plugin-colours'  // { pluginUri: '#rrggbb' }, per browser: every copy of a plugin
    var MIN_HEIGHT = 300      // a phone held sideways can be under 400 tall

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

    // Every settings screen that exists: one per settings window, and one per
    // pedal back in the performance view.
    //   { instance, host, kind: 'window' | 'back', actions: { exit, hop },
    //     root, scroller, barEl, panelEl, bar, hint, panel, info }
    var screens = []
    var screensOf = function (instance) { return screens.filter(function (s) { return s.instance === instance }) }
    var shown = function (st) { return st.root.is(':visible') && (st.kind !== 'window' || st.host.hasClass('nhe-settings-on')) }
    // rebuild every visible screen of a plugin (minimised sliders change the layout)
    var rebuildAll = function (instance) { screensOf(instance).forEach(function (st) { if (st.panel && shown(st)) build(st) }) }

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
        // every screen of that plugin follows
        screens.forEach(function (st) { if (st.info && st.info.uri === uri) NHE.accent.apply(st.root[0], hex) })
    }

    // the addressing dialog, over MOD's own (hidden) addressing form
    var openAddressing = function (st, symbol) {
        var instance = st.instance
        var a = mod.addressing(instance, symbol)
        if (!a) { mod.openAddressing(instance, symbol); return }
        var c = st.panel && st.panel.control(symbol)
        var slider = !!(c && NHE.Slider && c instanceof NHE.Slider)
        NHE.AddressingDialog({
            plugin: a.plugin, control: a.control, model: a.model,
            minimised: slider ? isMinimised(instance, symbol) : null,
            accent: colourOf(instance),
            onMinimise: function (on) { setMinimised(instance, symbol, on); rebuildAll(instance) }
        })
    }

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

    // a new screen for a plugin in host; actions.exit() / actions.hop(id) are
    // the system bar's EXIT and chain hop
    var createScreen = function (instance, host, kind, actions) {
        hookTempo()
        // st.gui: the plugin GUI this screen follows; a new one (pedalboard
        // reloaded, plugin updated) needs a new screen (see current())
        var st = { instance: instance, host: host, kind: kind, actions: actions, gui: mod.gui(instance) }
        st.root = $('<div class="nhe-settings">').attr('data-instance', instance).appendTo(host)
        st.scroller = $('<div class="nhe-settings__scroll">').appendTo(st.root)
        st.sizer = $('<div class="nhe-settings__sizer">').appendTo(st.scroller)
        var stage = st.stage = $('<div class="nhe-settings__stage">').appendTo(st.sizer)
        st.barEl = $('<div>').appendTo(stage)
        st.panelEl = $('<div>').appendTo(stage)
        var t = mod.tempo(), stats = mod.stats()
        st.bar = new NHE.SystemBar(st.barEl[0], {
            tempo: t.bpm, tempoLocked: t.locked, sync: t.sync,
            cpu: stats.cpu, ram: stats.ram, xruns: stats.xruns,
            tab: barTab(),
            // on a pedal's back the top-left button flips it over again
            exitIcon: kind === 'back' ? 'flip' : 'exit', exitLabel: kind === 'back' ? 'Flip' : 'Exit',
            onTab: function (tab) { try { localStorage.setItem(TAB_KEY, tab) } catch (e) {} },
            onExit: function () { st.actions.exit() },
            onTempo: function (bpm) { mod.setTempo(bpm) },
            onHop: function (id) { st.actions.hop(id) },
            onSet: function () { openSet(st) },
        })
        st.hint = NHE.scrollHint(st.scroller[0])

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
            if (symbol === ':presets') { refreshPresets(st); return }
            var c = st.panel.control(symbol)
            if (c) c.update({ binding: mod.binding(instance, symbol) })
        })
        mod.onPresetsChange(instance, function () { refreshPresets(st) })
        mod.onFilesChange(instance, function () { refreshFiles(st) })
        screens.push(st)
        return st
    }

    var build = function (st) {
        var instance = st.instance
        var info = mod.pluginInfo(instance)
        if (!info) return
        st.info = info
        NHE.accent.apply(st.root[0], colourOf(instance))

        // the column height follows the host, in the stage's own (scaled) px
        var z = NHE.settingsZoom ? NHE.settingsZoom() : 1
        var h = Math.max(MIN_HEIGHT, Math.floor(((st.root.innerHeight() || st.host.innerHeight()) - 8) / z))

        st.barEl.css('height', h + 'px')
        st.bar.update({ plugin: info.label, chain: mod.neighbours(instance), tab: barTab() })

        st.panel = new NHE.Panel(st.panelEl[0], {
            height: h,
            plugin: { name: info.label, on: mod.pluginOn(instance), binding: mod.binding(instance, ':bypass'),
                      presets: presetOptions(instance),
                      onColour: info.uri ? function () {
                          NHE.ColourDialog({ plugin: info.label, value: colourOf(instance), onPick: function (hex) { setColour(info.uri, hex) } })
                      } : null,
                      onInfo: info.uri && NHE.PluginInfoDialog ? function () { showInfo(instance, info) } : null,
                      onDelete: NHE.ConfirmDialog ? function () { askDelete(st, info) } : null,
                      // the plugin's GUI; not on a short screen (a phone held sideways), where the presets need the room
                      picture: info.uri && h >= 520 ? mod.pluginImage(info.uri, 'screenshot', info.gui) : null,
                      onPicture: function (img) { mod.cleanPicture(img) } },
            controls: info.ports.filter(function (p) { return (p.properties || []).indexOf('notOnGUI') < 0 }).map(function (p) { return describe(instance, p) }),
            onInput: function (id, v) { send(instance, id, v) },
            onChange: function (id, v) { send(instance, id, v) },
            onTrigger: function (id) { var p = mod.gui(instance).controls[id]; if (p) mod.setPortValue(instance, id, p.ranges.maximum) },
            onSettings: function (id) { openAddressing(st, id) },
            onPreset: function (action, p) {
                // Save as / Rename ask for the name in NHE's dialog
                mod.presetAction(instance, action, p && p.id, function (ask, done) {
                    NHE.NameDialog({
                        plugin: info.label, pill: action === 'rename' ? 'Rename' : 'Save as',
                        title: 'Preset name', icon: action === 'rename' ? 'rename' : 'saveAs',
                        value: ask.name, accent: colourOf(instance), onSave: done
                    })
                })
            },
            files: fileOptions(instance),
            onFile: function (uri, value) { mod.fileAction(instance, uri, value) },
            onT3K: function (uri) { mod.fileT3K(instance, uri) },
        })
        // the sizer takes the scaled stage's size, so the scroller can reach all of it
        var sr = st.stage[0].getBoundingClientRect()     // its zoomed size (CSS zoom), whatever offsetWidth means in this browser
        st.sizer.css({ width: Math.ceil(sr.width) + 'px', height: Math.ceil(sr.height) + 'px' })
        st.hint.update()
    }

    // the plugin's info page, as the + dialog shows it (components/constructor/add.js)
    var CATEGORIES = [{ id: 'ControlVoltage', label: 'Control Voltage' }]
    var showInfo = function (instance, info) {
        mod.pluginList(function (list) {
            var entry = list.filter(function (p) { return p.uri === info.uri })[0] || {}
            NHE.PluginInfoDialog({
                plugin: { uri: info.uri, name: info.name || info.label, brand: info.brand, categories: entry.category || [],
                          thumb: mod.pluginImage(info.uri, 'thumbnail', info.gui), favourite: mod.isFavourite(info.uri) },
                categories: CATEGORIES,
                loadInfo: function (p, done) { mod.pluginDetails(p.uri, function (d) { if (d) { p.ports = d.ports; p.info = d.info } else p.info = {}; done() }) },
                onFavourite: function (p, on) { mod.setFavourite(p.uri, on) }
            })
        })
    }

    // Delete, after a yes: what fed the plugin is connected straight to what
    // it fed (as if it were bypassed: NHE.autowire.heal), then MOD removes it
    var askDelete = function (st, info) {
        var instance = st.instance
        NHE.ConfirmDialog({
            plugin: info.label, pill: 'Delete', icon: 'remove',
            title: 'Delete this plugin?',
            text: 'What feeds it will be connected straight to what it feeds, as if it were bypassed.',
            yes: 'Yes, delete', no: 'No', accent: colourOf(instance),
            onYes: function () {
                var b = mod.board(), pedal = b.pedals.filter(function (p) { return p.instance === instance })[0]
                var heal = pedal && NHE.autowire ? NHE.autowire.heal({ ports: pedal.ports }, b.connections) : []
                heal.forEach(function (c) { mod.connect(c[0], c[1]) })
                // the screen goes with it: a window closes, a pedal's back flips over
                if (st.kind === 'back') st.actions.exit()
                mod.removePlugin(instance)
            }
        })
    }

    var presetOptions = function (instance) {
        var p = mod.presets(instance)
        var b = mod.binding(instance, ':presets')
        return { factory: p.factory, user: p.user, selected: p.selected, binding: b }
    }

    var fileOptions = function (instance) {
        return mod.fileLists(instance).map(function (f) { return { uri: f.uri, title: f.label, items: f.items, t3k: f.t3k } })
    }

    var refreshFiles = function (st) {
        if (!st.panel || !st.panel.files) return
        fileOptions(st.instance).forEach(function (f) { var c = st.panel.files[f.uri]; if (c) c.update({ items: f.items, t3k: f.t3k }) })
    }

    var refreshPresets = function (st) {
        if (st.panel && st.panel.presets) st.panel.presets.update(presetOptions(st.instance))
    }

    // a panel value -> MOD
    var send = function (instance, id, v) {
        if (id === ':bypass') { mod.setPluginOn(instance, v); return }
        var p = (mod.gui(instance).controls || {})[id]
        if (!p) return
        if (typeof v === 'boolean') v = v ? p.ranges.maximum : p.ranges.minimum
        mod.setPortValue(instance, id, Number(v))
    }

    // live system bar data, for every screen
    mod.onStats(function (stats) {
        screens.forEach(function (st) { st.bar.setStats({ cpu: stats.cpu, xruns: stats.xruns }); st.bar.setSysStats({ ram: stats.ram }) })
    })
    var tempoHooked = false
    var hookTempo = function () {
        if (tempoHooked) return
        tempoHooked = true
        mod.onTempo(function (t) { screens.forEach(function (st) { st.bar.setTempo(t.bpm, t.locked, t.sync) }) })
    }

    // ---- SET: NHE's own settings --------------------------------------------
    //
    // For now: which editor a plugin's settings window shows (NHE or MOD's
    // own). More settings will join it here.
    var openSet = function (st) {
        var overlay = $('<div class="nhe-ctl nhe-dialog-overlay">').appendTo('body')
        var d = $('<div class="nhe-dialog nhe-set-dialog" role="dialog" aria-modal="true" aria-label="NHE settings" tabindex="-1">').appendTo(overlay)
        NHE.accent.apply(overlay[0], colourOf(st.instance))
        var head = $('<div class="nhe-dialog__header">').appendTo(d)
        $('<span class="nhe-dialog__plugin">').text('NHE').appendTo(head)
        $('<span class="nhe-dialog__pill">').text('Settings').appendTo(head)
        $('<div class="nhe-dialog__title">').html(NHE.icons.gear + '<span>Plugin settings editor</span>').appendTo(d)
        var seg = $('<div>').appendTo($('<div class="nhe-dialog__setting">').appendTo(d))
        new NHE.Segmented(seg[0], { options: ['NHE', 'MOD'], value: view() === 'mod' ? 1 : 0, onChange: function (i) {
            setView(i ? 'mod' : 'nhe')
            // the open window follows at once; the back of a flipped pedal
            // always shows NHE's screen
            for (var k in windows) if (windows[k].host.is(':visible')) apply(windows[k])
        } })
        $('<div class="nhe-dialog__note">').text("What a plugin's gear opens: NHE's screen, or MOD's own settings panel. Remembered in this browser.").appendTo(d)

        // the builder: MOD's or NHE's (features/constructor)
        if (NHE.builder) {
            $('<div class="nhe-dialog__title nhe-set-dialog__section">').html(NHE.icons.chainView + '<span>Builder</span>').appendTo(d)
            var bseg = $('<div>').appendTo($('<div class="nhe-dialog__setting">').appendTo(d))
            // NHE first, as in the editor switch above
            new NHE.Segmented(bseg[0], { options: ['NHE', 'MOD'], value: NHE.builder.current() === 'nhe' ? 0 : 1, onChange: function (i) {
                NHE.builder.set(i ? 'mod' : 'nhe')
            } })
            $('<div class="nhe-dialog__note">').text("The pedalboard builder: NHE's grid with automatic wiring, or MOD's own. Remembered in this browser.").appendTo(d)
        }

        // the work surface: the builder's background (features/background)
        if (NHE.backgroundList) {
            $('<div class="nhe-dialog__title nhe-set-dialog__section">').html(NHE.icons.palette + '<span>Work surface</span>').appendTo(d)
            var select = $('<select class="nhe-dialog__input nhe-dialog__select" aria-label="Work surface">').appendTo(d)
            NHE.backgroundList(function (list) {
                var current = NHE.backgroundCurrent()
                $('<option>').val(NHE.backgroundMod).text("MOD's wood").appendTo(select)
                list.forEach(function (b) { $('<option>').val(b.file).text(b.name || b.file).appendTo(select) })
                select.val(current)
                select.data('list', list)
            })
            select.on('change', function () {
                var file = select.val(), found = null
                ;(select.data('list') || []).forEach(function (b) { if (b.file === file) found = b })
                if (file === NHE.backgroundMod) NHE.background(null)
                else NHE.background(file, found && found.height)
            })
        }
        var foot = $('<div class="nhe-dialog__buttons">').appendTo(d)
        var close = function () { overlay.remove() }
        foot.append(NHE.textButton('Close', 'primary', close))
        d.on('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } })
        d.on('keyup', function (e) { e.stopPropagation() })
        setTimeout(function () { d[0].focus() }, 0)
    }

    // ---- MOD's settings window ---------------------------------------------

    var windows = {}      // instance -> the window's screen

    // the screen kept for an instance, if it still belongs to the plugin
    // that is there now and (for a window) to that window; else it is dropped
    var current = function (store, instance, host) {
        var st = store[instance]
        if (st && st.gui === mod.gui(instance) && (!host || st.host[0] === host[0])) return st
        if (st) {
            st.root.remove()
            if (st.switchEl) st.switchEl.remove()
            screens.splice(screens.indexOf(st), 1)
            delete store[instance]
        }
        return null
    }

    var apply = function (st) {
        var v = view()
        st.host.toggleClass('nhe-settings-on', v === 'nhe')
        mod.fullBleed('window:' + st.instance, v === 'nhe')
        st.switcher.update({ value: v === 'nhe' ? 0 : 1 })
        if (v === 'nhe') build(st)
    }

    mod.onSettingsOpen(function (instance, win) {
        var st = current(windows, instance, win)
        if (!st) {
            st = windows[instance] = createScreen(instance, win, 'window', {
                exit: function () { mod.closeSettings(instance) },
                // hop through the chain: open that plugin's settings
                hop: function (id) { mod.closeSettings(instance); mod.openSettings(id) },
            })
            // the NHE / MOD switch floats in the window in both views (Close is
            // the system bar's EXIT in the NHE view, MOD's own button in MOD's)
            st.switchEl = $('<div class="nhe-settings__switch">').appendTo(win)
            st.switcher = new NHE.Segmented($('<div>').appendTo(st.switchEl)[0], { options: ['NHE', 'MOD'], value: 0, onChange: function (i) {
                setView(i ? 'mod' : 'nhe')
                apply(st)
            } })
        }
        // build once the window is laid out, so the height is known
        setTimeout(function () { apply(st) }, 0)
    })

    mod.onSettingsClose(function (instance) { mod.fullBleed('window:' + instance, false) })

    // ---- any other container: the back of a pedal in the performance view --

    var backs = {}        // instance -> its back screen

    NHE.settingsScreen = {
        // shows the plugin's screen in host (alone: other screens there are
        // detached), built for the host's current size
        mount: function (instance, host, actions) {
            var st = current(backs, instance)
            if (!st) st = backs[instance] = createScreen(instance, host, 'back', actions)
            st.actions = actions
            host.children('.nhe-settings').not(st.root).detach()
            if (!st.root.parent().is(host)) st.root.appendTo(host)
            st.host = host
            build(st)
            return st.root
        }
    }

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
            screens.forEach(function (st) { if (st.panel && shown(st)) build(st) })
        }, 200)
    })
})
