// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE's builder (docs/constructor-spec.md): the constructor's work surface
 * (components/constructor/surface.js) over MOD's builder, on MOD's real
 * pedalboard. SET → Builder chooses MOD's or NHE's (remembered in this
 * browser; MOD's by default); the switch at the surface's top right does
 * the same. In the console:
 *
 *   NHE.builder.set('nhe')    // or 'mod'
 *
 * MOD stays the source of truth: the surface shows what NHE.mod.board()
 * reads, and adding, moving and wiring go through NHE.mod (MOD's own calls);
 * the surface redraws from MOD's answer over the websocket.
 *
 * Positions: MOD keeps x / y per plugin (canvas px). Cells are STEP_X by
 * STEP_Y canvas px from an origin (the top left pedal when the board is
 * first shown, then kept while it's on screen), so a move here writes
 * origin + cell * STEP and reads back as the same cell. Pedals MOD placed
 * snap to the nearest cell; two that land on one cell are pushed to the
 * nearest free one (shown there only: nothing is written until moved).
 *
 * Faces: MOD's screenshots, as in the playground. A tap zooms one to 100%
 * (faceSize: MOD's icon's size) and borrows MOD's working icon
 * (mod.borrowIcon) into its place, so its knobs and switches play; it
 * goes back to MOD's canvas when the face lets go (zoomed out, another
 * one tapped, lifted, MOD's builder chosen). Each node's `jacks` (from
 * mod.board(), measured on MOD's icon) put the wires' ends where the face's
 * jacks really are.
 */
NHE.register('constructor', function (mod) {
    var KEY = 'nhe-builder'
    var STEP_X = 600, STEP_Y = 520          // canvas px per cell (MOD's pedals: about 230-610 wide, 290-480 tall)
    var CAT_ORDER = ['Delay', 'Distortion', 'Dynamics', 'Filter', 'Generator', 'Instrument', 'MIDI', 'Modulator', 'Reverb', 'Simulator', 'Spectral', 'Utility', 'ControlVoltage']
    var CAT_LABEL = { ControlVoltage: 'Control Voltage' }

    var saved = function () { try { return localStorage.getItem(KEY) === 'nhe' ? 'nhe' : 'mod' } catch (e) { return 'mod' } }

    var view = mod.addView('nhe-constructor', '<div class="nhe-constructor" style="display:none"></div>')
    var host = null, surface = null, switcher = null
    var origin = null                       // { x, y }: cell 0 / 0 in canvas px
    var caches = {}, cache = null, cacheId = null   // per board: wire colours, laid routes, grid size
    var pending = {}                        // instance -> node: added, its icon not drawn yet
    var nodes = [], connections = []
    var plugins = null, categories = []
    var retry = null

    var UNSAVED = '(unsaved)'
    var boardCache = function () {
        var id = cacheId = mod.boardId() || UNSAVED
        return caches[id] || (caches[id] = { colours: {}, routes: {}, cols: 0, rows: 0 })
    }

    // The layouts are kept by the board's bundle (MOD keeps the pedals'
    // places in the board itself): in localStorage "nhe-board-layouts", which
    // components/config.js keeps on the MOD, so every browser on it shares
    // them. The surface changes the cache's objects itself; keep() writes them
    // out after each change. A board never saved has no bundle: its layout
    // is kept once Save (as) gives it one.
    var LAYOUTS = 'nhe-board-layouts', KEEP_MS = 500
    try { caches = JSON.parse(localStorage.getItem(LAYOUTS) || '{}') || {} } catch (e) { caches = {} }
    delete caches[UNSAVED]
    var keepTimer = null
    var keep = function () {
        clearTimeout(keepTimer)
        keepTimer = setTimeout(function () {
            var out = {}
            Object.keys(caches).forEach(function (id) {
                var c = caches[id]
                if (id === UNSAVED || !c) return
                // nothing of its own: not kept
                if (!Object.keys(c.colours || {}).length && !Object.keys(c.routes || {}).length && !c.cols && !c.rows) return
                out[id] = c
            })
            try { localStorage.setItem(LAYOUTS, JSON.stringify(out)) } catch (e) {}
        }, KEEP_MS)
    }
    // the board saved under another bundle (Save as, or an unsaved board's
    // first Save): its layout goes with it
    var followSave = function () {
        var id = mod.boardId() || UNSAVED
        if (!cache || id === cacheId) return
        caches[id] = cache
        if (cacheId === UNSAVED) delete caches[UNSAVED]
        cacheId = id
        keep()
    }

    // ---- MOD's board -> the surface's nodes --------------------------------

    // a wide pedal takes two cells across; a tall one stays in one
    var spanOfSize = function (w, h) { return w >= 1.8 * h ? { w: 2, h: 1 } : { w: 1, h: 1 } }

    var read = function () {
        var b = mod.board(), out = []
        if (!origin && b.pedals.length) {
            origin = { x: Infinity, y: Infinity }
            b.pedals.forEach(function (p) { origin.x = Math.min(origin.x, p.x); origin.y = Math.min(origin.y, p.y) })
        }
        // pedals: nearest cell, the best fits first; a taken cell -> the nearest free one
        var taken = {}
        var free = function (c, r, s) {
            for (var i = c; i < c + s.w; i++) for (var j = r; j < r + s.h; j++) if (taken[i + ',' + j]) return false
            return c >= 0 && r >= 0
        }
        var take = function (c, r, s) { for (var i = c; i < c + s.w; i++) for (var j = r; j < r + s.h; j++) taken[i + ',' + j] = true }
        var before = {}
        nodes.forEach(function (n) { if (n.kind === 'pedal' && n.cell) before[n.id] = n.cell })
        var stays = function (q) { var c = before[q.p.instance]; return c && c.col === q.col && c.row === q.row }
        var placed = b.pedals.map(function (p) {
            var fx = (p.x - origin.x) / STEP_X, fy = (p.y - origin.y) / STEP_Y
            var col = Math.max(0, Math.round(fx)), row = Math.max(0, Math.round(fy))
            return { p: p, col: col, row: row, off: Math.abs(fx - col) + Math.abs(fy - row) }
        }).sort(function (a, b) {
            // the best fit first; on a tie, the pedal already shown in that cell keeps it
            var sa = stays(a) ? 0 : 1, sb = stays(b) ? 0 : 1
            return a.off - b.off || sa - sb || (a.p.instance < b.p.instance ? -1 : 1)
        })
        placed.forEach(function (q) {
            var p = q.p, s = spanOfSize(p.w, p.h), cell = null
            for (var d = 0; d < 60 && !cell; d++) {
                for (var r = q.row - d; r <= q.row + d && !cell; r++) for (var c = q.col - d; c <= q.col + d && !cell; c++) {
                    if (Math.max(Math.abs(c - q.col), Math.abs(r - q.row)) !== d) continue
                    if (free(c, r, s)) cell = { col: c, row: r }
                }
            }
            cell = cell || { col: q.col, row: q.row }
            take(cell.col, cell.row, s)
            delete pending[p.instance]
            out.push({
                id: p.instance, uri: p.uri, name: p.name, brand: p.brand, kind: 'pedal',
                thumb: mod.pluginImage(p.uri, 'thumbnail', p.gui), face: mod.pluginImage(p.uri, 'screenshot', p.gui),
                ports: p.ports, cell: cell, span: s, faceSize: { w: p.w, h: p.h },
                on: mod.pluginOn(p.instance),      // cards: the red dot
                jacks: p.jacks || undefined         // where MOD's face has them; else spread down its sides
            })
        })
        // added here, not drawn by MOD yet
        Object.keys(pending).forEach(function (k) { out.push(pending[k]) })

        // MOD's ports: audio first, then MIDI, then CV, each side in MOD's order
        var ORDER = { audio: 0, midi: 1, cv: 2 }
        var rows = { input: 0, output: 0 }
        b.system.slice().sort(function (a, c) { return (ORDER[a.type] - ORDER[c.type]) || (a.index - c.index) }).forEach(function (s) {
            var kind = s.source ? 'input' : 'output', ports = {}
            ports[s.type] = s.source ? { out: [s.port] } : { in: [s.port] }
            out.push({
                id: s.port, name: s.name, short: s.short, channel: s.channel, kind: kind,
                icon: s.type === 'midi' ? 'midi' : s.type === 'cv' ? 'cv' : 'assign',
                cell: { col: s.source ? -1 : 0, row: rows[kind]++ }, ports: ports
            })
        })
        nodes = out
        connections = b.connections
        // cards' red dots follow the plugins' on / off from MOD
        b.pedals.forEach(function (p) { mod.onPluginOn(p.instance, pluginOn) })
    }

    var pluginOn = function (instance, on) { if (surface) surface.setOn(instance, on) }

    var busy = function () {
        return surface && (surface.dragging || surface.root.classList.contains('is-moving') || surface.root.classList.contains('is-wiring'))
    }

    var refresh = function () {
        // mid-load the icons arrive one by one, sizes still settling: the
        // board is read once MOD is done
        if (!shown()) return
        // the surface sizes its grid from its element: wait for this
        // feature's stylesheet too (stylesheets load alongside, unblocked)
        var unstyled = !surface && getComputedStyle(view[0]).position !== 'absolute'
        if (mod.boardLoading() || busy() || unstyled) { clearTimeout(retry); retry = setTimeout(refresh, 250); return }
        read()
        if (!surface) create()
        else surface.update({ nodes: nodes, connections: connections, wireColours: cache.colours, wireRoutes: cache.routes, cvOutputs: cvOutputs() })
    }
    // MOD's Manage CV ports: on, the CV outputs' ticks and names
    var cvOutputs = function () { return mod.cvManaging() ? mod.cvOutputs() : null }

    // ---- the surface --------------------------------------------------------

    var create = function () {
        // the surface sets its own element's class: it goes inside ours
        host = $('<div class="nhe-constructor__surface"><div></div></div>').prependTo(view)
        surface = new NHE.Surface(host.children()[0], {
            nodes: nodes, connections: connections, cols: cache.cols, rows: cache.rows,
            wireColours: cache.colours, wireRoutes: cache.routes, cvOutputs: cvOutputs(),
            // a desktop (mouse): every face shows its working GUI, live, as on
            // MOD's builder; a touch screen: only the one zoomed in on
            liveAll: !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches),
            // MOD's own handlers register the port; the tags follow its state again
            onCvOutput: function (port, on, name) {
                mod.setCvOutput(port, on, name)
                setTimeout(function () { if (surface) surface.update({ cvOutputs: cvOutputs() }) }, 400)
            },
            onAdd: function (cell) { openAdd(cell) },
            // MOD's "No interface available" picture: the plain can instead
            onFaceLoad: function (img) { mod.cleanPicture(img) },
            // a cable's +: both ends ticked, only pedals that fit in it
            onInsert: function (r) { openAdd(r.cell, { inputs: [r.from.id], outputs: [r.to.id], only: r.kind }) },
            // cards (phones): the pedal's settings screen
            onTap: function (node) { if (node.kind === 'pedal' && !pending[node.id]) mod.openSettings(node.id) },
            onRewire: function (node) { if (!pending[node.id]) rewire(node) },
            // phones: an input with nothing on it opens the + dialog with it as the input,
            // the new pedal near the board's start
            onPortTap: function (node, connected) {
                if (node.kind !== 'input' || connected) return
                openAdd({ col: 0, row: 0 }, { inputs: [node.id] })
            },
            // faces: the gear at the pedal's top right, as on MOD's builder (NHE's settings screen, or MOD's)
            onSettings: function (node) { if (!pending[node.id]) mod.openSettings(node.id) },
            // zoomed in on a face: the bolt left of its gear, full screen on this pedal
            // (MOD's icons back first: the performance view moves the same icons
            // in; the live faces take them again when it closes)
            onPerformance: mod.canPerform() ? function (node) {
                if (pending[node.id]) return
                surface.release()
                mod.openPerformance(node.id)
            } : null,
            // faces: zoomed to 100%, MOD's working icon in the picture's place
            liveFace: function (node, layer) {
                if (pending[node.id]) return false
                var icon = mod.borrowIcon(node.id)
                if (!icon) return false
                var scaler = $('<div class="nhe-constructor__live">').appendTo(layer)
                scaler.css('transform', 'scale(' + (layer.offsetWidth / (icon.outerWidth() || layer.offsetWidth)) + ')')
                icon.addClass('nhe-constructor__icon').appendTo(scaler)
                // modgui's click on its background zooms MOD's own canvas: not from here
                layer.addEventListener('click', function (e) { if (mod.isIconBackground(e.target)) e.stopPropagation() }, true)
                return true
            },
            onBlur: function (node) {
                var icon = mod.plugins()[node.id]
                if (icon && icon.removeClass) icon.removeClass('nhe-constructor__icon')
                mod.returnIcon(node.id)
            },
            isControl: function (target) { return mod.isIconControl(target) },
            // a cable moved by hand: MOD's own disconnect, then connect
            onWire: function (old, neu) {
                keep()                    // its colour and route moved with it
                if (old) mod.disconnect(old[0], old[1])
                if (neu) mod.connect(neu[0], neu[1], function (ok) { if (!ok) refused(); refresh() })
            },
            onMove: function (node, cell) {
                if (pending[node.id]) return
                if (!origin) origin = { x: 0, y: 0 }
                mod.movePlugin(node.id, origin.x + cell.col * STEP_X, origin.y + cell.row * STEP_Y)
            },
            onColour: keep,
            onRoute: keep,
            onResize: function (cols, rows) { cache.cols = cols; cache.rows = rows; keep() }
        })
    }

    // a fresh surface (another board: its own grid size)
    var drop = function () {
        if (surface) surface.release()     // MOD's icons back first: remove() would clear their data
        if (host) host.remove()
        host = surface = null
    }

    // MOD's host said no to a connection (MOD's own builder only logs it):
    // the cable goes back as it was, and say why
    var refused = function () { mod.notify('error', "MOD couldn't make that connection. If none connect, restart MOD's audio engine (MOD Desktop: restart the app).") }

    // ---- the + dialog -------------------------------------------------------

    // a plugin's ports (symbols) and info page, from MOD (mod.pluginDetails)
    var loadPorts = function (plugin, done) {
        if (plugin.ports) { done(); return }
        mod.pluginDetails(plugin.uri, function (d) { if (d) plugin.ports = d.ports; done() })
    }
    var loadInfo = function (plugin, done) {
        if (plugin.info) { done(); return }
        mod.pluginDetails(plugin.uri, function (d) {
            if (d) { if (!plugin.ports) plugin.ports = d.ports; plugin.info = d.info }
            done()
        })
    }
    // the cells a new pedal takes, from its screenshot's shape (MOD's icon
    // isn't there yet; the screenshot is a picture of it, the thumbnail isn't
    // always the same shape)
    var spanOf = function (plugin, done) {
        if (plugin.span) { done(); return }
        var img = new Image()
        img.onload = function () { plugin.span = spanOfSize(img.naturalWidth, img.naturalHeight); done() }
        img.onerror = function () { plugin.span = { w: 1, h: 1 }; done() }
        img.src = mod.pluginImage(plugin.uri, 'screenshot', plugin.gui)
    }

    var withPlugins = function (cb) {
        if (plugins) {
            plugins.forEach(function (p) { p.favourite = mod.isFavourite(p.uri) })
            cb()
            return
        }
        mod.pluginList(function (list) {
            plugins = list.map(function (p) {
                return { uri: p.uri, name: p.name, brand: p.brand, categories: p.category || [], thumb: mod.pluginImage(p.uri, 'thumbnail', p.gui), gui: p.gui, iotype: p.iotype, favourite: mod.isFavourite(p.uri) }
            })
            var seen = {}
            plugins.forEach(function (p) { p.categories.forEach(function (c) { seen[c] = true }) })
            categories = CAT_ORDER.filter(function (c) { return seen[c] }).map(function (c) { return { id: c, label: CAT_LABEL[c] || c } })
            cb()
        })
    }

    // the nearest cell to `want` where a pedal of that span fits
    var fitCell = function (span, want) {
        var probe = { kind: 'pedal', span: span }
        want = want || { col: 0, row: 0 }
        for (var d = 0; d < 60; d++) for (var r = Math.max(0, want.row - d); r <= want.row + d; r++) for (var c = Math.max(0, want.col - d); c <= want.col + d; c++) {
            if (Math.max(Math.abs(c - want.col), Math.abs(r - want.row)) !== d) continue
            if (surface.fits(probe, c, r)) return { col: c, row: r }
        }
        return want
    }

    var nodeById = function (id) { return nodes.filter(function (n) { return n.id === id })[0] }

    // the plan's '{new}/symbol' ports -> the new instance's
    var fixPorts = function (list, instance) {
        return list.map(function (c) { return [c[0].replace(NHE.AddPedalDialog.NEW, instance), c[1].replace(NHE.AddPedalDialog.NEW, instance)] })
    }

    var openAdd = function (near, extra) {
        withPlugins(function () {
            NHE.AddPedalDialog($.extend({
                near: near && near.col !== undefined ? near : null,
                categories: categories, plugins: plugins, nodes: nodes, connections: connections,
                loadPorts: loadPorts, loadInfo: loadInfo,
                onFavourite: function (p, on) { mod.setFavourite(p.uri, on) },
                onPlace: function (r) { spanOf(r.plugin, function () { place(r, near) }) }
            }, extra || {}))
        })
    }

    // Place: add the pedal through MOD at its cell, then MOD's connect /
    // disconnect for the plan; the surface follows MOD's answers
    var place = function (r, near) {
        if (!surface) return
        if (!origin) origin = { x: 200, y: 150 }      // an empty board: MOD's canvas has room there
        var cell = fitCell(r.plugin.span, near && near.col !== undefined ? near : null)
        var instance = mod.addPlugin(r.plugin.uri, origin.x + cell.col * STEP_X, origin.y + cell.row * STEP_Y, function (inst) {
            if (!inst) { delete pending[instance]; refresh(); return }
            r.plan.disconnect.forEach(function (c) { mod.disconnect(c[0], c[1]) })
            fixPorts(r.plan.connect, inst).forEach(function (c) { mod.connect(c[0], c[1], function (ok) { if (!ok) refused() }) })
        })
        if (!instance) return
        // shown at once, without ports, until MOD draws it
        pending[instance] = { id: instance, uri: r.plugin.uri, name: r.plugin.name, brand: r.plugin.brand, kind: 'pedal', thumb: r.plugin.thumb, face: mod.pluginImage(r.plugin.uri, 'screenshot', r.plugin.gui), ports: {}, cell: cell, span: r.plugin.span }
        refresh()
    }

    // a pedal's plug button (a card's, or beside a face's gear): the + dialog
    // with the pedal picked and its wiring ticked; Rewire then disconnects
    // what it had and connects what's ticked now, or, with another plugin
    // picked, swaps the pedal for it
    var rewire = function (node) {
        var owner = function (port) { return nodes.filter(function (n) { return ['audio', 'midi', 'cv'].some(function (t) { var p = n.ports[t] || {}; return (p.in || []).concat(p.out || []).indexOf(port) >= 0 }) })[0] }
        var ins = {}, outs = {}, mine = []
        connections.forEach(function (c) {
            var a = owner(c[0]), b = owner(c[1])
            if (b === node && a) { ins[a.id] = true; mine.push(c) }
            if (a === node && b) { outs[b.id] = true; mine.push(c) }
        })
        withPlugins(function () {
            var plugin = plugins.filter(function (p) { return p.uri === node.uri })[0]
            if (!plugin) return
            openAdd(node.cell, {
                plugin: plugin, exclude: [node.id], inputs: Object.keys(ins), outputs: Object.keys(outs), placeLabel: 'Rewire',
                onPlace: function (r) {
                    // another plugin picked: it takes this one's place. MOD removes
                    // the old one (its cables go with it), then the new one goes
                    // into the same cell, wired as ticked (as the + dialog's Place)
                    if (r.plugin.uri !== node.uri) {
                        var gone = function (p) { return p.indexOf(node.id + '/') === 0 }
                        r.plan.disconnect = r.plan.disconnect.filter(function (c) { return !gone(c[0]) && !gone(c[1]) })
                        mod.removePlugin(node.id, function () {
                            nodes = nodes.filter(function (n) { return n.id !== node.id })
                            connections = connections.filter(function (c) { return !gone(c[0]) && !gone(c[1]) })
                            if (surface) surface.update({ nodes: nodes, connections: connections })
                            spanOf(r.plugin, function () { place(r, node.cell) })
                        })
                        return
                    }
                    var want = fixPorts(r.plan.connect, node.id), key = function (c) { return c[0] + '>' + c[1] }
                    var keep = {}
                    want.forEach(function (c) { keep[key(c)] = true })
                    mine.forEach(function (c) { if (!keep[key(c)]) mod.disconnect(c[0], c[1]) })
                    r.plan.disconnect.forEach(function (c) { mod.disconnect(c[0], c[1]) })
                    var have = {}
                    connections.forEach(function (c) { have[key(c)] = true })
                    want.forEach(function (c) { if (!have[key(c)]) mod.connect(c[0], c[1]) })
                }
            })
        })
    }

    // ---- MOD's builder or NHE's --------------------------------------------

    var shown = function () { return saved() === 'nhe' }

    var apply = function () {
        var on = shown()
        if (!on && surface) surface.release()  // MOD's builder gets its icons back
        view.toggle(on)
        mod.coverBuilder(on)
        if (switcher) switcher.update({ value: on ? 0 : 1 })
        if (on) {
            cache = cache || boardCache()
            if (surface && !mod.performing()) surface.resume()
            refresh()
        }
    }

    NHE.builder = {
        current: saved,
        set: function (v) {
            try { localStorage.setItem(KEY, v === 'nhe' ? 'nhe' : 'mod') } catch (e) {}
            apply()
            return saved()
        }
    }

    // the switch at the top right: back to MOD's builder
    var sw = $('<div class="nhe-ctl nhe-constructor__switch">').appendTo(view)
    switcher = new NHE.Segmented($('<div>').appendTo(sw)[0], {
        options: ['NHE', 'MOD'], value: shown() ? 0 : 1,
        onChange: function (i) { NHE.builder.set(i ? 'mod' : 'nhe') }
    })
    sw.attr('title', 'Builder: NHE\'s or MOD\'s')

    // SET → Work surface changed (features/background): the surface's image
    window.addEventListener('nhe-background', function () { if (surface) { surface.texture(); surface.apply() } })

    mod.onBoardChange(function (reloaded) {
        if (reloaded) {
            origin = null
            pending = {}
            if (!mod.boardId()) delete caches[UNSAVED]      // a new, empty board starts afresh
            cache = boardCache()
            drop()
        }
        if (shown()) refresh()
    })
    // MOD's title changes when a board is saved: under a new bundle, the layout follows
    mod.onBoardName(function () { setTimeout(followSave, 300) })   // the bundle may be set just after the title
    // the performance view gives MOD's icons back as it closes: the live faces take them again
    mod.onPerformanceOpen(function () { if (surface) surface.release() })
    // and back in the builder, zoomed in on the pedal the carousel was showing
    mod.onPerformanceClose(function (instance) {
        if (!surface || !shown()) return
        surface.resume()
        var nd = instance && surface.node(instance)
        if (nd && nd.cell && surface.faces) surface.focus(nd)
    })
    // MOD's Manage CV ports switched on or off: the tags come or go
    mod.onCvManaging(function () { if (surface) surface.update({ cvOutputs: cvOutputs() }) })
    // a board loaded before NHE started (or while it was MOD's builder)
    // gets its own origin when first shown
    cache = boardCache()
    apply()
})
