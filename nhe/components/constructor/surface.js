// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * The constructor's work surface (docs/constructor-spec.md): a grid of
 * fixed-size cells that pans and zooms, pedals fixed in cells, MOD's own
 * ports on the left and right edges, a + on every free cell, and the wires
 * drawn as straight runs with rounded corners. Needs controls.js / .css and
 * constructor.css.
 *
 *   var s = new NHE.Surface(root, {
 *       nodes: [{ id, name, brand, thumb, colour, icon,
 *                 kind: 'pedal' | 'input' | 'output',
 *                 cell: { col, row },       // pedals; MOD's ports: their row on the edge
 *                 span: { w: 1|2, h: 1|2 }, // pedals taking two cells (optional)
 *                 ports }],                 // as in autowire.js
 *       connections: [[fromPort, toPort]],
 *       cols, rows,                         // the grid's size as last kept (optional)
 *       onAdd: fn(cell),                    // a + was tapped
 *       onInsert: fn({ connection, from, to, kind, cell }), // a cable's small + was tapped:
 *                                           // a pedal to go in between (cell: nearest the +)
 *       faces: true | false,                // pedals as their faces, a tap zooms in (default:
 *                                           // a desktop or large tablet); else cards, a tap is onTap
 *       onTap: fn(node),                    // a pedal card was tapped (phones: its settings screen)
 *       onRewire: fn(node),                 // a pedal's plug button: a card's (phones: no hand
 *                                           // wiring), or left of a face's gear
 *       onPortTap: fn(node, connected),     // cards: one of MOD's port tiles was tapped
 *       onSettings: fn(node),               // a face's gear, just outside its top right
 *                                           // corner (as on MOD's builder): its settings
 *       onFocus: fn(node),                  // a face was tapped and zoomed to its full size
 *       onPerformance: fn(node),            // a focused face's bolt, left of its gear: the
 *                                           // performance view, on this pedal
 *       onFaceLoad: fn(img, node),          // a pedal's picture came in (may swap its src)
 *       zoomRight: true | false,          // the zoom buttons stacked at the right edge, + on top,
 *                                           // MOD's output tiles below (or above) them; with no room
 *                                           // for that, left of the tiles (default: bottom left)
 *       liveAll: true | false,              // faces: every face live and playing, as on MOD's
 *                                           // builder (a desktop); else only the focused one
 *       liveFace: fn(node, layer),          // the focused face: put the pedal's working GUI
 *                                           // in `layer` (over its picture, the picture's size),
 *                                           // return true if it did; called again after a redraw
 *       onBlur: fn(node),                   // the focused face let go (zoomed out, another one
 *                                           // focused, lifted): take the working GUI back
 *       isControl: fn(target),              // a press there belongs to the live GUI (a knob,
 *                                           // a switch); elsewhere on it, it pans / lifts as usual
 *       wireColours: { 'from>to': colour }, // cables given their own colour (faces)
 *       onWire: fn(old, neu),               // a cable was rewired by hand (faces): old / neu are
 *                                           // [from, to] or null (a new cable / one pulled out)
 *       onColour: fn(connection, colour),   // a cable's colour was picked (null: by its type)
 *       wireRoutes: { 'from>to': [[x, y], ...] }, // cables laid by hand (faces): their corners
 *       onRoute: fn(connection, points),    // a cable was laid by hand (null: back to automatic)
 *       onMove: fn(node, cell),             // a pedal was long-pressed and dropped on a free cell
 *       onResize: fn(cols, rows),           // the grid grew or shrank
 *       cvOutputs: null | { portId: { on, name, fixed } }, // MOD's Manage CV ports is on (faces):
 *                                           // beside each pedal's CV output a tick (offer it as a
 *                                           // CV source to assign controls to) and its name
 *       onCvOutput: fn(portId, on, name)    // a tick or a name changed there
 *   })
 *   s.update({ nodes, connections })
 *   s.release() / s.resume()   // every live face's GUI given back (onBlur), and taken again
 *   s.setOn(id, on)            // a card's red dot: the plugin is on
 *
 * A pedal node may carry `face`: its full-size picture (MOD's screenshot),
 * shown instead of `thumb` in faces mode, `faceSize`: { w, h }, the
 * pedal's own size within that picture (MOD's screenshot has a margin
 * round the pedal; the pedal sits in its middle at 1:1), and `jacks`:
 * { portId: { x, y } },
 * where each jack sits on that face (fractions of its width and height).
 * In faces mode the wires run from jack to jack; a face without `jacks`
 * gets them spread down its sides (inputs left, outputs right).
 *
 * Hand wiring (faces): every jack shows a socket, every cable a plug at
 * both ends. Drag a plug to another jack to move that end, or off into
 * nothing to pull the cable out; drag from a free socket to plug in a new
 * one; tap a plug on a jack with several cables to spread them out and
 * pick one; press and hold a cable, then drag, to move that stretch of it
 * (where its corners go: the cable keeps the new way); tap a cable to pick
 * its colour (or put it back on its automatic way). Cables that would share a
 * track run in lanes beside each other; several from one jack part right
 * after it.
 *
 * Grid size: it starts at the screen's size and keeps exactly one empty
 * column at the right and one empty row at the bottom: a second empty one
 * goes again, and when none is left an Expand button adds one.
 *
 * Touch: drag to pan (also starting on a pedal, as long as it moves before
 * the long-press), two fingers to pinch-zoom, a long-press (LONG_MS) on a
 * pedal lifts it to move it. Mouse: drag, the wheel pans, ctrl / pinch on a
 * trackpad zooms, the + / - buttons zoom. A double click (or tap) on the
 * surface itself zooms out to show the whole grid.
 *
 * Faces: a tap zooms the face to 120% (FOCUS) and makes it live (liveFace): its
 * controls then play, and only a press on an empty part of it pans or
 * lifts it. It stays live while panning, until the view zooms out, another
 * face is tapped, or it is lifted.
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon
    var SVG = 'http://www.w3.org/2000/svg'

    var CELL = 200          // px at zoom 1
    var EDGE = 120          // the columns for MOD's ports, left and right
    var PAD = 18            // a pedal's margin inside its cell (the wires run there)
    var LONG_MS = 450       // a press this long on a pedal lifts it
    var SLOP = 8            // px a pointer can move and still count as a tap / press
    var ZMIN = 0.35, ZMAX = 4.8  // room to show a large face at FOCUS x its full size
    var FOCUS = 1.2         // a tapped face zooms to 120% of its own size (easier to play)
    var FIT_ABOVE = 44, FIT_BELOW = 44   // screen px a focused pedal keeps free above (its gear) and below (its name)
    var MIN_COLS = 3, MIN_ROWS = 3
    var FOOT = 96           // a strip under the grid for the Expand buttons
    var HEAD = 30           // screen px above the top row: room for the faces' gears
    var RIGHT_ROOM = 160    // plane px the view can pan past the last column: the cables to MOD's outputs
    var PORT = 48           // MOD's port tiles: screen px, flush against the screen's left and right edges
    var SIDE = 0            // (Figma: 48 x 48, rounded on the inner side only)
    var PORT_STEP = 84      // one port to the next, down the edge (tile, label, gap)
    var PORT_LABEL = 20     // the label under a tile
    var ZOOM_GAP = 16       // zoomRight: between the zoom buttons and MOD's output tiles
    var NAME_H = 30         // a pedal's name and brand under its face
    // the work surface image (tokens.css: --nhe-texture, holes every half
    // tile, the first at --nhe-texture-hole): tiled so its holes come three
    // to a cell and one sits under every + (a cell's centre)
    var TILE = CELL * 2 / 3
    var mod = function (a, m) { return ((a % m) + m) % m }

    var Surface = function (root, options) {
        var self = this
        this.root = root
        this.o = mix({ nodes: [], connections: [] }, options || {})
        this.view = { x: 0, y: HEAD, z: 1 }
        root.innerHTML = ''
        root.className = 'nhe-ctl nhe-surface'
        // a desktop or large tablet: the faces, as in MOD's builder (a tap
        // zooms in to play them); a phone: cards, a tap opens the settings
        this.faces = this.o.faces != null ? !!this.o.faces : Math.min(screen.width, screen.height) >= 600
        root.classList.toggle('is-faces', this.faces)
        root.classList.toggle('is-zoom-right', !!this.o.zoomRight)
        this.texture()
        var n = this.n = {}
        n.plane = el('div', 'nhe-surface__plane', root)
        n.cells = el('div', 'nhe-surface__cells', n.plane)
        n.wires = document.createElementNS(SVG, 'svg')
        n.wires.setAttribute('class', 'nhe-surface__wires')
        n.plane.appendChild(n.wires)
        n.items = el('div', 'nhe-surface__items', n.plane)
        // plugs and sockets over the faces
        n.plugs = document.createElementNS(SVG, 'svg')
        n.plugs.setAttribute('class', 'nhe-surface__plugs')
        n.plane.appendChild(n.plugs)
        // Manage CV ports: the CV outputs' ticks and names (renderCvTags)
        n.cvTags = el('div', 'nhe-surface__cvtags', n.plane)
        // MOD's ports don't pan sideways: they stay against the screen's edges
        n.edge = el('div', 'nhe-surface__edge', root)
        // zoom buttons (desktop); pinch does the same
        var zoom = n.zoom = el('div', 'nhe-surface__zoom', root)
        // − then +: zooming in at the right
        ;[['−', 0.8, 'Zoom out'], ['+', 1.25, 'Zoom in']].forEach(function (z) {
            var b = el('button', null, zoom)
            b.type = 'button'
            b.textContent = z[0]
            b.setAttribute('aria-label', z[2])
            b.addEventListener('click', function () { self.zoomAt(root.clientWidth / 2, root.clientHeight / 2, self.view.z * z[1]) })
        })

        // the grid starts at the screen's size (the surface's own px: a page
        // that scales it, NHE.zoom on a phone, doesn't count)
        var r = { width: root.clientWidth, height: root.clientHeight }
        this.safe()
        var gap = (this.gapL() + this.gapR()) / 2              // the port tiles' strips, each side
        this.minCols = Math.max(MIN_COLS, Math.floor((r.width - 2 * gap) / CELL))
        this.minRows = Math.max(MIN_ROWS, Math.floor((r.height - FOOT) / CELL))
        this.cols = Math.max(this.minCols, this.o.cols || 0)
        this.rows = Math.max(this.minRows, this.o.rows || 0)
        // a narrow screen (a phone) starts zoomed out to about two and a half
        // columns and MOD's ports (the half: room for cables out to the right);
        // more is a pan or a pinch away
        var fit = (r.width - 2 * gap) / (2.5 * CELL)
        if (fit < 1) {
            this.view.z = Math.max(ZMIN, fit)
            this.minRows = Math.max(MIN_ROWS, Math.floor((r.height / this.view.z - FOOT) / CELL))
            this.rows = Math.max(this.minRows, this.o.rows || 0)
        }

        // the first column starts clear of the port tiles on the left
        this.view.x = this.gapL() - EDGE * this.view.z

        this.pointers()
        root.addEventListener('wheel', function (e) { self.wheel(e) }, { passive: false })
        // a long press on a phone or tablet: no context menu (Android), it lifts a pedal
        root.addEventListener('contextmenu', function (e) { if (!self.onLive(e.target)) e.preventDefault() })
        this.render()

        // the surface's own size changed (a window resize, a rotated tablet):
        // MOD's ports move to the new edges, so the wires to them are drawn
        // again; the grid keeps at least the screen's size
        this.seen = { w: r.width, h: r.height }
        if (window.ResizeObserver) {
            var queued = false
            new ResizeObserver(function () {
                if (queued) return
                queued = true
                requestAnimationFrame(function () { queued = false; self.resized() })
            }).observe(root)
        }
    }

    // a phone held sideways, with the page under its notch / Dynamic Island
    // (viewport-fit=cover, NHE.mod.fullBleed): MOD's port tiles keep clear of
    // it (env(safe-area-inset-left / right), measured on a probe; 0 elsewhere)
    Surface.prototype.safe = function () {
        var p = this.n && this.n.safe
        if (!p) {
            p = el('div', 'nhe-surface__safe', this.root)
            if (this.n) this.n.safe = p
        }
        var cs = getComputedStyle(p)
        this.inL = parseFloat(cs.paddingLeft) || 0
        this.inR = parseFloat(cs.paddingRight) || 0
        // tiles held off the screen's edge (notch side): rounded all round
        this.root.classList.toggle('is-inset-l', this.inL > 0)
        this.root.classList.toggle('is-inset-r', this.inR > 0)
    }
    Surface.prototype.gapL = function () { return (this.inL || 0) + SIDE + PORT + 8 }
    Surface.prototype.gapR = function () { return (this.inR || 0) + SIDE + PORT + 8 }

    Surface.prototype.resized = function () {
        var W = this.root.clientWidth, Hh = this.root.clientHeight
        if (!W || !Hh || (W === this.seen.w && Hh === this.seen.h)) return
        this.seen = { w: W, h: Hh }
        this.safe()
        var z = Math.min(1, this.view.z)
        this.minCols = Math.max(MIN_COLS, Math.floor((W / z - this.gapL() - this.gapR()) / CELL))
        this.minRows = Math.max(MIN_ROWS, Math.floor((Hh / z - FOOT) / CELL))
        this.clamp()
        this.render()
        // a focused pedal fits the new size too
        var f = this.focused && this.node(this.focused.id)
        if (f) this.focus(f)
    }

    // ---- geometry -----------------------------------------------------------

    Surface.prototype.span = function (nd) { return { w: (nd.span && nd.span.w) || 1, h: (nd.span && nd.span.h) || 1 } }
    Surface.prototype.cellX = function (col) { return EDGE + col * CELL }
    Surface.prototype.cellY = function (row) { return row * CELL }

    // a node's box on the plane
    Surface.prototype.box = function (nd) {
        // MOD's ports: where their tile is on screen, in plane coordinates
        if (nd.kind === 'input' || nd.kind === 'output') {
            var v = this.view, W = this.root.clientWidth
            var sx = nd.kind === 'input' ? (this.inL || 0) + SIDE : W - (this.inR || 0) - SIDE - PORT
            return { x: (sx - v.x) / v.z, y: (this.portTop(nd) - v.y) / v.z, w: PORT / v.z, h: PORT / v.z, port: true }
        }
        var s = this.span(nd)
        return { x: this.cellX(nd.cell.col) + PAD, y: this.cellY(nd.cell.row) + PAD, w: s.w * CELL - 2 * PAD, h: s.h * CELL - 2 * PAD }
    }

    // which pedal (if any) covers a cell
    Surface.prototype.occupant = function (col, row, except) {
        var self = this
        return this.o.nodes.filter(function (nd) {
            if (nd.kind !== 'pedal' || nd === except || !nd.cell) return false
            var s = self.span(nd)
            return col >= nd.cell.col && col < nd.cell.col + s.w && row >= nd.cell.row && row < nd.cell.row + s.h
        })[0]
    }

    Surface.prototype.fits = function (nd, col, row) {
        var s = this.span(nd)
        if (col < 0 || row < 0) return false
        for (var c = col; c < col + s.w; c++) for (var r = row; r < row + s.h; r++) if (this.occupant(c, r, nd)) return false
        return true
    }

    // Always exactly one empty column at the right and one empty row at the
    // bottom, never smaller than the screen; with none empty, Expand shows.
    Surface.prototype.size = function () {
        var self = this, usedC = 0, usedR = 0
        this.o.nodes.forEach(function (nd) {
            if (nd.kind !== 'pedal' || !nd.cell) return
            var s = self.span(nd)
            usedC = Math.max(usedC, nd.cell.col + s.w)
            usedR = Math.max(usedR, nd.cell.row + s.h)
        })
        var cols = Math.max(this.minCols, usedC, Math.min(this.cols, usedC + 1))
        var rows = Math.max(this.minRows, usedR, Math.min(this.rows, usedR + 1))
        var changed = cols !== this.cols || rows !== this.rows
        this.cols = cols
        this.rows = rows
        this.full = { cols: cols === usedC, rows: rows === usedR }
        if (changed && typeof this.o.onResize === 'function') this.o.onResize(cols, rows)
    }

    // ---- drawing ------------------------------------------------------------

    Surface.prototype.update = function (options) { this.o = mix(this.o, options || {}); this.render() }

    // The surface's image: NHE's grid texture (--nhe-texture, its holes lined
    // up with the cells: one under every +), or another one chosen in SET
    // (--nhe-surface-texture, tiled --nhe-surface-tile px tall at zoom 1)
    Surface.prototype.texture = function () {
        var cs = getComputedStyle(this.root), other = parseFloat(cs.getPropertyValue('--nhe-surface-tile'))
        if (other > 0 && cs.getPropertyValue('--nhe-surface-texture').replace(/\s/g, '')) {
            this.tile = other
            this.bg = { x: 0, y: 0 }
            return
        }
        var hole = (parseFloat(cs.getPropertyValue('--nhe-texture-hole')) || 0) * TILE
        this.tile = TILE
        this.bg = { x: mod(EDGE + CELL / 2 - hole, TILE / 2), y: mod(CELL / 2 - hole, TILE / 2) }
    }

    Surface.prototype.render = function () {
        var self = this, n = this.n
        this.texture()
        this.size()
        var W = 2 * EDGE + this.cols * CELL, Hh = this.rows * CELL
        n.plane.style.width = W + 'px'
        n.plane.style.height = (Hh + FOOT) + 'px'
        n.wires.setAttribute('width', W)
        n.wires.setAttribute('height', Hh)
        n.plugs.setAttribute('width', W)
        n.plugs.setAttribute('height', Hh)

        // a + on every free cell
        n.cells.innerHTML = ''
        for (var r = 0; r < this.rows; r++) for (var c = 0; c < this.cols; c++) {
            if (this.occupant(c, r)) continue
            ;(function (c, r) {
                // the free cell: on a desktop its + shows while the pointer is over it
                var f = el('div', 'nhe-surface__free', n.cells)
                f.style.left = self.cellX(c) + 'px'
                f.style.top = self.cellY(r) + 'px'
                f.style.width = f.style.height = CELL + 'px'
                var b = el('button', 'nhe-surface__plus', f, icon('plus'))
                b.type = 'button'
                b.setAttribute('aria-label', 'Add a pedal here')
                b.addEventListener('click', function () { if (!self.moved && typeof self.o.onAdd === 'function') self.o.onAdd({ col: c, row: r }) })
            })(c, r)
        }
        // Expand: only when no empty column / row is left
        var expand = function (cls, label, x, y, fn) {
            var b = el('button', 'nhe-surface__expand ' + cls, n.cells, icon(cls.indexOf('col') >= 0 ? 'expandCol' : 'expandRow') + '<span>' + label + '</span>')
            b.type = 'button'
            b.style.left = x + 'px'
            b.style.top = y + 'px'
            b.addEventListener('click', function () { if (!self.moved) fn() })
        }
        // in the strip under the grid: a column at the right, a row in the middle
        if (this.full.cols) expand('nhe-surface__expand--col', 'Expand surface', this.cellX(this.cols) + EDGE / 2, Hh + FOOT / 2, function () { self.cols++; self.render() })
        if (this.full.rows) expand('nhe-surface__expand--row', 'Expand surface', EDGE + this.cols * CELL / 2, Hh + FOOT / 2, function () { self.rows++; self.render() })

        // pedals in the plane; MOD's ports in the edge layer (placed in apply)
        n.items.innerHTML = ''
        n.edge.innerHTML = ''
        this.els = {}
        this.portEls = []
        this.o.nodes.forEach(function (nd) {
            if (!nd.cell) return
            if (nd.kind === 'input' || nd.kind === 'output') {
                var pd = el('div', 'nhe-surface__item is-port is-' + nd.kind, n.edge)
                pd.setAttribute('data-id', nd.id)
                // audio: the plug, plugged in when something is connected
                var ic = nd.icon === 'midi' ? 'midi' : (self.connected(nd) ? 'assign' : 'plug')
                var tile = el('span', 'nhe-surface__port', pd, icon(ic))
                // a small triangle: a connected pedal is out of view, that way
                var arrow = el('span', 'nhe-surface__tri', tile)
                el('span', 'nhe-surface__label', pd).textContent = nd.short || nd.name
                pd.title = nd.name
                self.portEls.push({ node: nd, el: pd, arrow: arrow })
                return
            }
            var b = self.box(nd)
            // a face: no card (its 8 px padding) and 20% larger, its name kept clear
            if (self.faces) {
                var fw = 1.2 * (b.w - 16), fh = 1.2 * (b.h - 16 - NAME_H) + NAME_H
                b = { x: b.x + (b.w - fw) / 2, y: b.y + (b.h - fh) / 2, w: fw, h: fh }
            }
            var d = el('div', 'nhe-surface__item is-pedal', n.items)
            d.style.left = b.x + 'px'
            d.style.top = b.y + 'px'
            d.style.width = b.w + 'px'
            d.style.height = b.h + 'px'
            d.setAttribute('data-id', nd.id)
            {
                var face = el('div', 'nhe-surface__face', d)
                if (nd.thumb) {
                    var img = el('img', null, face)
                    img.alt = ''
                    img.draggable = false
                    // the jacks are measured on the picture: draw the wires again once it's in
                    img.onload = function () {
                        if (typeof self.o.onFaceLoad === 'function') self.o.onFaceLoad(img, nd)
                        if (self.faces) { self.renderWires(); self.placeGear(nd) }
                    }
                    // the full-size picture for cards too: MOD's thumbnails are about 40 x 64
                    // px and blur when a phone shows a card larger than that
                    img.src = nd.face || nd.thumb
                } else {
                    face.classList.add('is-blank')
                    face.style.setProperty('--tile', nd.colour || '#555')
                    face.textContent = (nd.name || '?').split(/\s+/).map(function (w) { return w[0] }).join('').slice(0, 3).toUpperCase()
                }
                // faces: name and maker in a label hung right under the pedal itself (placeGear)
                var lab = self.faces ? el('div', 'nhe-surface__caption', d) : d
                el('span', 'nhe-surface__name', lab).textContent = nd.name
                // cards (phones): a plug button, top right, for the wiring dialog
                if (!self.faces) {
                    var rw = el('button', 'nhe-surface__rewire', d, icon('plug'))
                    rw.type = 'button'
                    rw.setAttribute('aria-label', 'Wiring of ' + nd.name)
                    rw.addEventListener('click', function () { if (!self.moved && typeof self.o.onRewire === 'function') self.o.onRewire(nd) })
                }
                if (nd.brand) el('span', 'nhe-surface__brand', lab).textContent = nd.brand
                // faces: a gear just outside the pedal's top right corner, for its settings
                if (self.faces && typeof self.o.onSettings === 'function') {
                    var gear = el('button', 'nhe-surface__gear', d, icon('gear'))
                    gear.type = 'button'
                    gear.setAttribute('aria-label', 'Settings of ' + nd.name)
                    gear.title = 'Settings'
                    gear.addEventListener('click', function () { if (!self.moved) self.o.onSettings(nd) })
                }
                // faces: the plug left of the gear, as on a card: its wiring (replace it, other ins and outs)
                if (self.faces && typeof self.o.onRewire === 'function') {
                    var pl = el('button', 'nhe-surface__plugbtn', d, icon('plug'))
                    pl.type = 'button'
                    pl.setAttribute('aria-label', 'Wiring of ' + nd.name)
                    pl.title = 'Wiring'
                    pl.addEventListener('click', function () { if (!self.moved) self.o.onRewire(nd) })
                }
                // zoomed in on it (focused): the performance view's bolt left of those, the last step to full screen
                if (self.faces && typeof self.o.onPerformance === 'function') {
                    var perf = el('button', 'nhe-surface__perf', d, icon('bolt'))
                    perf.type = 'button'
                    perf.setAttribute('aria-label', 'Performance view')
                    perf.title = 'Performance view'
                    perf.addEventListener('click', function () { if (!self.moved) self.o.onPerformance(nd) })
                }
            }
            // cards: a red dot at the top left while the plugin is on (a face shows its own light)
            if (!self.faces) {
                el('span', 'nhe-surface__led', d).setAttribute('aria-hidden', 'true')
                d.classList.toggle('is-on', !!nd.on)
            }
            self.els[nd.id] = d
            self.placeGear(nd)
        })
        this.mountLive()
        this.apply()
    }

    // ---- wires --------------------------------------------------------------

    // which node owns a port
    Surface.prototype.ownerOf = function (portId) {
        return this.o.nodes.filter(function (nd) {
            return ['audio', 'midi', 'cv'].some(function (t) {
                var p = (nd.ports && nd.ports[t]) || {}
                return (p.in || []).indexOf(portId) >= 0 || (p.out || []).indexOf(portId) >= 0
            })
        })[0]
    }
    var kindOf = function (nd, portId) {
        var k = 'audio'
        ;['audio', 'midi', 'cv'].forEach(function (t) {
            var p = (nd.ports && nd.ports[t]) || {}
            if ((p.in || []).indexOf(portId) >= 0 || (p.out || []).indexOf(portId) >= 0) k = t
        })
        return k
    }

    // where a pedal's jack is, in plane coordinates (faces mode): on the
    // picture as drawn, from `jacks` when given, else spread down its side
    Surface.prototype.jack = function (nd, portId, dir) {
        var d = this.els[nd.id], pic = d && d.querySelector('.nhe-surface__face img, .nhe-surface__face.is-blank')
        if (!pic) return null
        var R = this.root.getBoundingClientRect(), r = pic.getBoundingClientRect()
        if (!r.width || !r.height) return null
        var v = this.view, k = (R.width / this.root.clientWidth) || 1   // the page may be scaled (NHE.zoom)
        var x = ((r.left - R.left) / k - v.x) / v.z, y = ((r.top - R.top) / k - v.y) / v.z
        var w = r.width / k / v.z, h = r.height / k / v.z
        var a = this.inner(nd, pic, w, h)
        x += a.x
        y += a.y
        w = a.w
        h = a.h
        var j = nd.jacks && nd.jacks[portId]
        if (j) return { x: x + j.x * w, y: y + j.y * h }
        var list = []
        ;['audio', 'midi', 'cv'].forEach(function (t) { list = list.concat(((nd.ports && nd.ports[t]) || {})[dir] || []) })
        var i = Math.max(0, list.indexOf(portId)), n = list.length || 1, step = Math.min(h / (n + 1), 44)
        return { x: dir === 'in' ? x : x + w, y: y + h / 2 + (i - (n - 1) / 2) * step }
    }

    // the pedal within its picture (w x h as drawn): faceSize at the
    // picture's scale, centred; the whole picture without a faceSize
    Surface.prototype.inner = function (nd, pic, w, h) {
        var f = nd.faceSize, nw = pic && pic.naturalWidth
        if (!f || !f.w || !f.h || !nw) return { x: 0, y: 0, w: w, h: h }
        var k = w / nw, iw = Math.min(w, f.w * k), ih = Math.min(h, f.h * k)
        return { x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih }
    }

    // a polyline with rounded corners
    var rounded = function (pts, rad) {
        var d = 'M' + pts[0][0] + ' ' + pts[0][1]
        for (var i = 1; i < pts.length - 1; i++) {
            var p = pts[i], a = pts[i - 1], b = pts[i + 1]
            var la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1])
            var r = Math.min(rad, la / 2, lb / 2)
            if (!r) { d += ' L' + p[0] + ' ' + p[1]; continue }
            var p1 = [p[0] - (p[0] - a[0]) / la * r, p[1] - (p[1] - a[1]) / la * r]
            var p2 = [p[0] + (b[0] - p[0]) / lb * r, p[1] + (b[1] - p[1]) / lb * r]
            d += ' L' + p1[0] + ' ' + p1[1] + ' Q' + p[0] + ' ' + p[1] + ' ' + p2[0] + ' ' + p2[1]
        }
        var last = pts[pts.length - 1]
        return d + ' L' + last[0] + ' ' + last[1]
    }

    // Straight runs along the gaps between cells: out of the source's right
    // side, down / up in the gap just before the target's column, into the
    // target's left side. Going backwards (target left of the source), the
    // wire crosses in the gap between the two rows (under the source when
    // they share a row).
    // p1 / p2: the jacks, when known (faces); else the sides' middles
    // early: one of several cables from the same jack; they part right
    // after it rather than just before their targets
    // lead: how far a cable runs straight out of / into a jack before it
    // bends (faces: past the nut and the connector, then LEAD; as far as the
    // gap allows)
    Surface.prototype.lead = function () { return this.faces ? this.nutW() + this.plugLen() + LEAD : 6 }
    // the nut zooms with its connector: zoomed in, both keep their screen size
    Surface.prototype.nutW = function () { return NUT * this.plugLen() / PLUG_LEN }
    // a connector's length on the plane: PLUG_LEN, or less when zoomed in so
    // it stays PLUG_MAX_H tall on screen
    Surface.prototype.plugLen = function () { return Math.min(PLUG_LEN, PLUG_MAX_H * PLUG_W / PLUG_H / this.view.z) }
    Surface.prototype.route = function (a, b, off, p1, p2, early) {
        var x1 = a.x + a.w, y1 = a.y + a.h / 2 + off, x2 = b.x, y2 = b.y + b.h / 2 + off, L = this.lead()
        if (p1) { x1 = p1.x; y1 = p1.y }
        if (p2) { x2 = p2.x; y2 = p2.y }
        if (x2 > x1 + 4) {
            var xm = early ? Math.min(x1 + PAD + off, x2 - 6) : Math.max(x1 + 6, x2 - PAD + off)
            // a straight lead-in at both ends; a gap too narrow for both: its middle
            xm = x2 - x1 >= 2 * L ? Math.max(x1 + L, Math.min(x2 - L, xm)) : (x1 + x2) / 2
            return [[x1, y1], [xm, y1], [xm, y2], [x2, y2]]
        }
        // backwards: cross in the gap between the two rows (the target's side
        // of the source); on the same row, in the gap under it
        var ya = a.y + a.h / 2, yb = b.y + b.h / 2, cross
        if (yb < ya - CELL / 2) cross = Math.floor(a.y / CELL) * CELL + off                       // target above: the gap over the source
        else if (yb > ya + CELL / 2) cross = Math.ceil((a.y + a.h) / CELL) * CELL + off            // target below: the gap under it
        else cross = Math.ceil((a.y + a.h) / CELL) * CELL - PAD / 2 + off                          // same row: under
        var la = Math.max(PAD / 2, L) + off, lb = Math.max(PAD / 2, L) - off
        return [[x1, y1], [x1 + la, y1], [x1 + la, cross], [x2 - lb, cross], [x2 - lb, y2], [x2, y2]]
    }

    var LANE = 14           // cables keep this far apart (centre to centre; they're 6 wide)
    var NUT = 6             // faces: a jack's metal nut stands this far out of the pedal's side
    var PLUG_LEN = 20       // a cable's connector, plane px (plugDefs) ...
    var PLUG_MAX_H = 44     // ... but never taller on screen than this (about MOD's port tiles)
    var LEAD = 12           // straight cable out of a connector before the first bend
    var COLOURS = ['#6152f0', '#3e8ef7', '#2ea7a0', '#46a758', '#f5d90a', '#f08c2e', '#e5484d', '#e93d82', '#f0f0f0', '#8b8d98']

    var svgEl = function (name, cls, parent, attrs) {
        var e = document.createElementNS(SVG, name)
        if (cls) e.setAttribute('class', cls)
        Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]) })
        if (parent) parent.appendChild(e)
        return e
    }

    Surface.prototype.colourOf = function (c) { return (this.o.wireColours || {})[c[0] + '>' + c[1]] || null }

    // Cables keep LANE apart: each middle run that would come closer than
    // that to another cable's run (along the same stretch) moves aside,
    // trying 0, +1, -1, +2, ... lanes. The runs out of and into the jacks
    // can't move: the others keep clear of them. Cables from the same jack
    // (or into the same one) may share runs: that's where they part (join).
    var lanes = function (wires, L) {
        var placed = []
        var seg = function (w, i) {
            var a = w.pts[i], b = w.pts[i + 1], vert = Math.abs(a[0] - b[0]) < 0.5
            var lo = vert ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]), hi = vert ? Math.max(a[1], b[1]) : Math.max(a[0], b[0])
            if (hi - lo < 1) return null
            return { w: w, i: i, vert: vert, pos: vert ? a[0] : a[1], lo: lo, hi: hi, src: w.c[0], dst: w.c[1] }
        }
        var clash = function (sg, pos) {
            return placed.some(function (o) {
                return o.w !== sg.w && o.vert === sg.vert && o.src !== sg.src && o.dst !== sg.dst &&
                    Math.abs(o.pos - pos) < LANE && sg.lo < o.hi + LANE && o.lo < sg.hi + LANE
            })
        }
        // fixed: the runs out of and into the jacks, and every run of a cable laid by hand
        wires.forEach(function (w) {
            var n = w.pts.length
            for (var i = 0; i < n - 1; i++) {
                if (!w.laid && i !== 0 && i !== n - 2) continue
                var sg = seg(w, i)
                if (sg) placed.push(sg)
            }
        })
        wires.forEach(function (w) {
            if (w.laid) return
            for (var i = 1; i < w.pts.length - 2; i++) {
                var sg = seg(w, i)
                if (!sg) continue
                // a run across may not move into the straight lead-ins at the ends
                var n = w.pts.length, lo = w.pts[0][0] + L, hi = w.pts[n - 1][0] - L
                var inside = function (pos) { return !sg.vert || lo >= hi || (pos >= lo && pos <= hi) || pos === sg.pos }
                var shift = 0
                for (var k = 0; k < 12; k++) {
                    shift = Math.ceil(k / 2) * (k % 2 ? 1 : -1) * LANE
                    if (inside(sg.pos + shift) && !clash(sg, sg.pos + shift)) break
                }
                var ax = sg.vert ? 0 : 1
                w.pts[i][ax] += shift
                w.pts[i + 1][ax] += shift
                sg.pos += shift
                placed.push(sg)
            }
        })
    }

    Surface.prototype.renderWires = function () {
        var self = this, svg = this.n.wires, top = this.n.plugs, drag = this.dragging
        while (svg.firstChild) svg.removeChild(svg.firstChild)
        while (top.firstChild) top.removeChild(top.firstChild)
        var count = {}, away = {}, wires = [], fans = {}
        this.o.connections.forEach(function (c) { fans[c[0]] = (fans[c[0]] || 0) + 1 })
        this.o.connections.forEach(function (c, ci) {
            if (drag && drag.ci === ci) return           // its end is in the hand
            var from = self.ownerOf(c[0]), to = self.ownerOf(c[1])
            if (!from || !to || !from.cell || !to.cell) return
            // a wire between one of MOD's ports and a pedal out of view, or
            // reaching under the port's edge, isn't drawn: the port shows a
            // triangle towards the pedal instead
            var port = from.kind === 'input' ? from : to.kind === 'output' ? to : null
            var pedal = port === from ? to : from
            if (port && pedal.kind === 'pedal' && !self.clearOf(port, self.box(pedal))) {
                if (!away[port.id]) away[port.id] = pedal
                return
            }
            // cards: stereo pairs between the same two pedals leave side by side
            var key = from.id + '>' + to.id, k = count[key] = (count[key] || 0) + 1
            var off = self.faces ? 0 : (k - 1) * 8
            var p1 = self.faces && from.kind === 'pedal' ? self.jack(from, c[0], 'out') : null
            var p2 = self.faces && to.kind === 'pedal' ? self.jack(to, c[1], 'in') : null
            var pts = self.route(self.box(from), self.box(to), off, p1, p2, self.faces && fans[c[0]] > 1)
            var laid = self.faces && self.laid(c, pts, from, to)
            wires.push({ c: c, ci: ci, kind: kindOf(from, c[0]), pts: laid || pts, laid: !!laid })
        })
        lanes(wires, this.lead())
        // a jack's cables spread out (its plug was tapped): each plug apart, to pick one
        var sp = this.spread
        if (sp) {
            var at = wires.filter(function (w) { return w.c[sp.end === 'to' ? 1 : 0] === sp.port })
            at.forEach(function (w, i) {
                var dy = (i - (at.length - 1) / 2) * 26, p = w.pts, n = p.length
                if (sp.end === 'to') { p[n - 1][1] += dy; p[n - 2][1] += dy }
                else { p[0][1] += dy; p[1][1] += dy }
            })
        }
        this.wirePts = {}
        wires.forEach(function (w) {
            var path = svgEl('path', 'nhe-surface__wire is-' + w.kind, svg, { d: rounded(w.pts, 14) })
            var colour = self.colourOf(w.c)
            if (colour) path.style.stroke = colour
            self.wirePts[w.ci] = w.pts
            // a wider, invisible copy takes the taps (faces: the colour)
            if (self.faces) svgEl('path', 'nhe-surface__wire-hit', svg, { d: path.getAttribute('d'), 'data-cable': w.ci })
        })
        if (this.faces) {
            this.renderSockets()
            wires.forEach(function (w) {
                var a = w.pts[0], b = w.pts[w.pts.length - 1]
                self.plug(a, 1, w, 'from', self.ownerOf(w.c[0]).kind !== 'pedal')
                self.plug(b, -1, w, 'to', self.ownerOf(w.c[1]).kind !== 'pedal')
            })
            ;(this.hints || []).forEach(function (h) { top.appendChild(h) })
        }
        this.renderCvTags()
        // the triangles: which side a connected pedal out of view lies
        ;(this.portEls || []).forEach(function (p) {
            var target = away[p.node.id]
            p.el.classList.toggle('has-arrow', !!target)
            p.el.classList.toggle('is-target', !!(drag && self.tileTarget(p.node, drag)))
            if (!target) return
            // just left or right: "something that way"
            var b = self.box(target), pb = self.box(p.node)
            var left = (b.x + b.w / 2) < (pb.x + pb.w / 2)
            p.arrow.classList.toggle('is-left', left)
            p.arrow.classList.toggle('is-right', !left)
            p.el.classList.toggle('tri-left', left)
            p.el.classList.toggle('tri-right', !left)
            p.el.title = p.node.name + ' → ' + target.name + ' (out of view)'
        })
        if (drag && drag.path) top.appendChild(drag.path)
        if (!drag && !this.root.classList.contains('is-bending')) this.renderInserts(wires)
    }

    // A small + in the middle of each cable (one for all the cables between
    // the same two pedals): a pedal goes in between there. It sits halfway
    // along the cable's longest straight run.
    Surface.prototype.renderInserts = function (wires) {
        var self = this, seen = {}
        wires.forEach(function (w) {
            var from = self.ownerOf(w.c[0]), to = self.ownerOf(w.c[1]), pair = from.id + '>' + to.id
            if (seen[pair]) return
            var best = null, len = 0, p = tidy(w.pts)   // straight pieces as one run
            for (var i = 0; i < p.length - 1; i++) {
                var a = p[i], b = p[i + 1], l = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
                if (l > len) { len = l; best = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }
            }
            // too short a run for it (beside the plugs, on faces): hidden until the
            // pedals move apart. Cards have no plugs: the gap between two will do
            if (!best || len < (self.faces ? 64 : 20)) return
            seen[pair] = true
            // in the cable's colour; with the cables, under the pedals (a face
            // that covers it hides it)
            var g = svgEl('g', 'nhe-surface__insert is-' + w.kind, self.n.wires)
            svgEl('circle', 'nhe-surface__insert-hit', g, { cx: best[0], cy: best[1], r: 22 })
            // a white + with an edge in the cable's colour
            var d = 'M' + (best[0] - 7) + ' ' + best[1] + 'h14M' + best[0] + ' ' + (best[1] - 7) + 'v14'
            var edge = svgEl('path', 'nhe-surface__insert-edge', g, { d: d })
            var colour = self.colourOf(w.c)
            if (colour) edge.style.stroke = colour
            svgEl('path', 'nhe-surface__insert-plus', g, { d: d })
            g.appendChild(document.createElementNS(SVG, 'title')).textContent = 'Add a pedal between ' + from.name + ' and ' + to.name
            g.addEventListener('click', function () {
                if (self.moved || typeof self.o.onInsert !== 'function') return
                var col = Math.max(0, Math.min(self.cols - 1, Math.floor((best[0] - EDGE) / CELL)))
                var row = Math.max(0, Math.min(self.rows - 1, Math.floor(best[1] / CELL)))
                self.o.onInsert({ connection: w.c, from: from, to: to, kind: w.kind, cell: { col: col, row: row } })
            })
        })
    }

    // a plug on a cable's end: dir 1 leaves rightwards (out of an output),
    // -1 arrives from the left (into an input)
    // The cable connectors (NHE-MOD-UI/SVG "coming out" and "going-in"):
    // a ribbed metal barrel, flat against the jack, rounded where the cable
    // leaves it. Defined once per page, drawn with <use>.
    var PLUG_W = 103.62, PLUG_H = 68.71
    var plugDefs = function () {
        if (document.getElementById('nhe-plug-in')) return
        var grad = function (id) {
            return '<linearGradient id="' + id + '" x1="51.81" y1=".5" x2="51.81" y2="68.21" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0" stop-color="#656668"/><stop offset=".19" stop-color="#fff"/><stop offset=".56" stop-color="#656668"/>' +
                '<stop offset=".86" stop-color="#b1b3b6"/><stop offset="1" stop-color="#656668"/></linearGradient>'
        }
        var body = 'M12.5.5h90.62v67.71H12.5c-6.62,0-12-5.38-12-12V12.5C.5,5.88,5.88.5,12.5.5Z'
        var line = function (x) { return '<line x1="' + x + '" y1=".5" x2="' + x + '" y2="68.21"/>' }
        var stroke = ' stroke="#000" stroke-miterlimit="10"'
        var holder = document.createElementNS(SVG, 'svg')
        holder.setAttribute('width', 0)
        holder.setAttribute('height', 0)
        holder.setAttribute('aria-hidden', 'true')
        holder.style.position = 'absolute'
        holder.innerHTML = '<defs>' + grad('nhe-plug-grad') +
            '<linearGradient id="nhe-nut-grad" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="#656668"/><stop offset=".19" stop-color="#fff"/><stop offset=".56" stop-color="#656668"/>' +
                '<stop offset=".86" stop-color="#b1b3b6"/><stop offset="1" stop-color="#656668"/></linearGradient>' +
            // going in: the cable from the left, the flat end against an input jack on the right
            '<symbol id="nhe-plug-in" viewBox="0 0 ' + PLUG_W + ' ' + PLUG_H + '"><path d="' + body + '" fill="url(#nhe-plug-grad)"' + stroke + '/>' +
                '<g fill="none"' + stroke + '>' + [29.04, 40.04, 51.04, 62.04, 73.04, 84.04].map(line).join('') + '</g></symbol>' +
            // coming out: the flat end against an output jack on the left, the cable leaving to the right
            '<symbol id="nhe-plug-out" viewBox="0 0 ' + PLUG_W + ' ' + PLUG_H + '"><path d="' + body + '" transform="translate(103.62 68.71) rotate(-180)" fill="url(#nhe-plug-grad)"' + stroke + '/>' +
                '<g fill="none"' + stroke + '>' + [74.58, 63.58, 52.58, 41.58, 30.58, 19.58].map(line).join('') + '</g></symbol>' +
            '</defs>'
        document.body.appendChild(holder)
    }

    // tile: the end is at one of MOD's port tiles (no nut: the connector touches it)
    Surface.prototype.plug = function (pt, dir, w, end, tile) {
        plugDefs()
        var g = svgEl('g', 'nhe-surface__plug is-' + w.kind, this.n.plugs, { 'data-ci': w.ci, 'data-end': end })
        var pw = this.plugLen(), ph = pw * PLUG_H / PLUG_W, nut = tile ? 0 : this.nutW()
        // out of an output (dir > 0): right of the jack; into an input: left of it
        var x = dir > 0 ? pt[0] + nut : pt[0] - nut - pw
        var hh = Math.max(ph, 24 / this.view.z)       // a finger-sized hit area
        svgEl('rect', 'nhe-surface__plug-hit', g, { x: x - 6, y: pt[1] - hh / 2, width: pw + 12, height: hh })
        var use = svgEl('use', 'nhe-surface__plug-body', g, { x: x, y: pt[1] - ph / 2, width: pw, height: ph })
        use.setAttribute('href', dir > 0 ? '#nhe-plug-out' : '#nhe-plug-in')
        g.appendChild(document.createElementNS(SVG, 'title')).textContent = 'Drag to move this end' + (this.shared(w.c, end) ? '; tap to spread the cables on this jack' : '')
    }

    // does another cable share this end's jack?
    Surface.prototype.shared = function (c, end) {
        var i = end === 'to' ? 1 : 0
        return this.o.connections.filter(function (o) { return o[i] === c[i] }).length > 1
    }

    // a socket on every jack of every face (the plugs cover the used ones)
    // Jacks, as on MOD's builder: a metal nut on the pedal's side (inputs
    // left, outputs right). While a cable is in the hand, every jack that
    // takes it shows an arrow pointing in, and the one it would go into
    // (the nearest, within reach) chevrons in the accent colour. An output
    // in use has a stub: a small connector under its plug, half see-through,
    // to pull another cable from (MOD's spare jack).
    Surface.prototype.renderSockets = function () {
        var self = this, drag = this.dragging, used = {}, usedIn = {}
        plugDefs()
        this.o.connections.forEach(function (c) { used[c[0]] = true; usedIn[c[1]] = true })
        this.hints = []
        this.o.nodes.forEach(function (nd) {
            if (nd.kind !== 'pedal' || !nd.cell || !self.els[nd.id]) return
            ;['audio', 'midi', 'cv'].forEach(function (t) {
                ;['in', 'out'].forEach(function (dir) {
                    var list = ((nd.ports && nd.ports[t]) || {})[dir] || []
                    list.forEach(function (port, pi) {
                        var j = self.jack(nd, port, dir)
                        if (!j) return
                        var side = dir === 'in' ? -1 : 1, NW = self.nutW(), k = NW / NUT
                        var ok = drag && drag.want.dir === dir && drag.want.kind === t && drag.fixedNode !== nd
                        var hot = ok && drag.target && drag.target.port === port
                        var stub = dir === 'out' && used[port]
                        // the nut: a flange against the pedal, a barrel standing out
                        var nut = svgEl('g', 'nhe-surface__nut is-' + t, self.n.plugs)
                        svgEl('rect', 'nhe-surface__nut-flange', nut, { x: side < 0 ? j.x - 2 * k : j.x, y: j.y - 10 * k, width: 2 * k, height: 20 * k, rx: 0.5 * k })
                        svgEl('rect', 'nhe-surface__nut-barrel', nut, { x: side < 0 ? j.x - NW : j.x + 2 * k, y: j.y - 6 * k, width: NW - 2 * k, height: 12 * k, rx: 1.5 * k })
                        if (!used[port] || dir === 'in') svgEl('rect', 'nhe-surface__nut-hole', nut, { x: side < 0 ? j.x - NW : j.x + NW - 1.5 * k, y: j.y - 3 * k, width: 1.5 * k, height: 6 * k })

                        var g = svgEl('g', 'nhe-surface__socket is-' + t + (stub ? ' is-stub' : '') + (ok ? ' is-target' : '') + (hot ? ' is-hot' : ''), self.n.plugs,
                            { 'data-port': port, 'data-dir': dir, 'data-node': nd.id, 'data-x': j.x, 'data-y': j.y })
                        if (stub) {
                            // MOD's spare jack: a smaller connector under the plug
                            // under the plug; the first of a pair (stereo: L) above it, so the two keep clear
                            var sw = self.plugLen() * 0.62, sh = sw * PLUG_H / PLUG_W, sx = j.x + NW, half = self.plugLen() * PLUG_H / PLUG_W / 2
                            var sy = pi === 0 && list.length > 1 ? j.y - half - 1 - sh : j.y + half + 1
                            svgEl('rect', 'nhe-surface__socket-hit', g, { x: sx - 4, y: sy - 3, width: sw + 8, height: sh + 6 })
                            var u = svgEl('use', 'nhe-surface__stub', g, { x: sx, y: sy, width: sw, height: sh })
                            u.setAttribute('href', '#nhe-plug-out')
                            g.appendChild(document.createElementNS(SVG, 'title')).textContent = 'Drag to plug in another cable'
                        } else {
                            svgEl('circle', 'nhe-surface__socket-hit', g, { cx: j.x + side * NW / 2, cy: j.y, r: 14 })
                        }
                        // the hint while wiring: an arrow into the jack; chevrons on the one it would take
                        // (over the plugs, past one already in the jack: drawn last, in renderWires)
                        if (ok) {
                            var past = (dir === 'in' ? usedIn[port] : used[port]) ? self.plugLen() : 0
                            var tip = j.x + side * (NW + 3 * k + past), flip = side < 0 ? 1 : -1
                            var hint = svgEl('g', 'nhe-surface__hint' + (hot ? ' is-hot' : ''), null, { transform: 'translate(' + tip + ' ' + j.y + ') scale(' + (flip * k) + ' ' + k + ')' })
                            self.hints.push(hint)
                            if (hot) svgEl('path', 'nhe-surface__hint-chevrons', hint, { d: 'M-34 -12 l11 12 l-11 12 M-20 -12 l11 12 l-11 12' })
                            else svgEl('path', 'nhe-surface__hint-arrow', hint, { d: 'M-22 -4 h12 v-5 l10 9 l-10 9 v-5 h-12 z' })
                        }
                    })
                })
            })
        })
    }

    // Manage CV ports (cvOutputs, faces): as on MOD's builder, beside each
    // pedal's CV output a tick, and its name once ticked (typed over to
    // rename it). Past the nut and any plug in it; screen-sized as the plugs.
    Surface.prototype.renderCvTags = function () {
        var self = this, box = this.n.cvTags, cv = this.o.cvOutputs, used = {}
        box.innerHTML = ''
        if (!cv || !this.faces) return
        this.o.connections.forEach(function (c) { used[c[0]] = true })
        var NW = this.nutW(), k = NW / NUT
        this.o.nodes.forEach(function (nd) {
            if (nd.kind !== 'pedal' || !nd.cell || !self.els[nd.id]) return
            ;(((nd.ports && nd.ports.cv) || {}).out || []).forEach(function (port) {
                var st = cv[port], j = st && self.jack(nd, port, 'out')
                if (!j) return
                var t = el('div', 'nhe-surface__cvtag' + (st.on ? ' is-on' : ''), box)
                t.style.left = (j.x + NW + (used[port] ? self.plugLen() : 0) + 4 * k) + 'px'
                t.style.top = j.y + 'px'
                t.style.transform = 'translateY(-50%) scale(' + k + ')'
                var tick = el('input', 'nhe-surface__cvtag-tick', t)
                tick.type = 'checkbox'
                tick.checked = !!st.on
                tick.disabled = !!st.fixed
                tick.setAttribute('aria-label', 'Use as a CV source')
                tick.title = 'Use as a CV source'
                var name = el('input', 'nhe-surface__cvtag-name', t)
                name.type = 'text'
                name.value = st.name || ''
                name.disabled = !!st.fixed
                name.setAttribute('aria-label', 'CV source name')
                name.setAttribute('spellcheck', 'false')
                var emit = function (on) { if (typeof self.o.onCvOutput === 'function') self.o.onCvOutput(port, on, name.value.trim() || st.name || '') }
                // ticked: its name ready to type over, also after the tags are drawn again
                tick.addEventListener('change', function () {
                    t.classList.toggle('is-on', tick.checked)
                    self.cvFocus = tick.checked ? port : null
                    emit(tick.checked)
                    if (tick.checked) name.select()
                })
                if (self.cvFocus === port && st.on) setTimeout(function () { name.focus(); name.select() }, 0)
                name.addEventListener('blur', function () { if (self.cvFocus === port) self.cvFocus = null })
                name.addEventListener('change', function () { emit(true) })
                name.addEventListener('keydown', function (e) {
                    e.stopPropagation()            // MOD listens for keys on the page
                    if (e.key === 'Enter') name.blur()
                })
                name.addEventListener('keyup', function (e) { e.stopPropagation() })
            })
        })
    }

    // ---- hand wiring (faces) -------------------------------------------------

    // which of a port tile's ports takes the cable in the hand, if any
    Surface.prototype.tileTarget = function (nd, drag) {
        if (nd === drag.fixedNode) return null
        // MOD's inputs are cables' sources (outs), its outputs their ends (ins)
        var list = ((nd.ports && nd.ports[drag.want.kind]) || {})[drag.want.dir] || []
        return list[0] || null
    }

    Surface.prototype.toPlane = function (q) { var v = this.view; return { x: (q.x - v.x) / v.z, y: (q.y - v.y) / v.z } }

    // a plug or a socket was dragged past the slop: take that end in hand
    Surface.prototype.beginWire = function (g) {
        var hit = g.hit, d = { want: {} }
        if (hit.hasAttribute('data-ci')) {
            var ci = +hit.getAttribute('data-ci'), c = this.o.connections[ci], pts = this.wirePts[ci]
            var moveTo = hit.getAttribute('data-end') === 'to'
            d.ci = ci
            d.old = c
            d.fixedPort = moveTo ? c[0] : c[1]
            d.fixed = moveTo ? pts[0] : pts[pts.length - 1]
            d.moveTo = moveTo
        } else if (hit.classList.contains('is-port')) {
            // one of MOD's port tiles: its In is a cable's source, its Out an end
            var tn = this.node(hit.getAttribute('data-id')), b = this.box(tn), src = tn.kind === 'input'
            var tp = null
            ;['audio', 'midi', 'cv'].forEach(function (t) { var l = ((tn.ports && tn.ports[t]) || {})[src ? 'out' : 'in'] || []; if (!tp && l.length) tp = l[0] })
            if (!tp) return false
            d.fixedPort = tp
            d.fixed = [src ? b.x + b.w : b.x, b.y + b.h / 2]
            d.moveTo = src
        } else {
            var port = hit.getAttribute('data-port'), dir = hit.getAttribute('data-dir')
            d.fixedPort = port
            d.fixed = [+hit.getAttribute('data-x'), +hit.getAttribute('data-y')]
            d.moveTo = dir === 'out'       // from an output: the free end goes to an input
        }
        d.fixedNode = this.ownerOf(d.fixedPort)
        d.want = { dir: d.moveTo ? 'in' : 'out', kind: kindOf(d.fixedNode, d.fixedPort) }
        d.path = svgEl('path', 'nhe-surface__wire is-loose is-' + d.want.kind)
        var colour = d.old && this.colourOf(d.old)
        if (colour) d.path.style.stroke = colour
        this.dragging = d
        this.root.classList.add('is-wiring')
        this.renderWires()
        return true
    }

    Surface.prototype.dragWire = function (q) {
        var self = this, d = this.dragging, p = this.toPlane(q), best = null, bestD = 40 / this.view.z
        // the nearest jack (or MOD port tile) that takes it
        Array.prototype.forEach.call(this.n.plugs.querySelectorAll('.nhe-surface__socket.is-target'), function (s) {
            // near the jack, or where its plug would sit (past the nut)
            var x = +s.getAttribute('data-x'), y = +s.getAttribute('data-y'), side = s.getAttribute('data-dir') === 'in' ? -1 : 1
            var dist = Math.min(Math.hypot(x - p.x, y - p.y), Math.hypot(x + side * (self.nutW() + self.plugLen() / 2) - p.x, y - p.y))
            if (dist < bestD) { bestD = dist; best = { port: s.getAttribute('data-port'), x: x, y: y } }
        })
        ;(this.portEls || []).forEach(function (pe) {
            var port = self.tileTarget(pe.node, d)
            if (!port) return
            var r = pe.el.querySelector('.nhe-surface__port').getBoundingClientRect(), R = self.root.getBoundingClientRect(), k = self.scale()
            if (q.x >= (r.left - R.left) / k - 8 && q.x <= (r.right - R.left) / k + 8 && q.y >= (r.top - R.top) / k - 8 && q.y <= (r.bottom - R.top) / k + 8) {
                var b = self.box(pe.node)
                best = { port: port, x: d.want.dir === 'in' ? b.x : b.x + b.w, y: b.y + b.h / 2 }
                bestD = 0
            }
        })
        var prev = d.target && d.target.port
        d.target = best
        var end = best ? [best.x, best.y] : [p.x, p.y]
        var a = d.moveTo ? d.fixed : end, b = d.moveTo ? end : d.fixed
        var xm = (a[0] + b[0]) / 2
        d.path.setAttribute('d', rounded([[a[0], a[1]], [xm, a[1]], [xm, b[1]], [b[0], b[1]]], 14))
        if ((best && best.port) !== prev) this.renderWires()
    }

    // let go: onto a jack it connects there; into nothing a plug pulls the
    // cable out (as on MOD), a new one is dropped
    Surface.prototype.dropWire = function (cancel) {
        var d = this.dragging, conns = this.o.connections
        this.dragging = null
        this.spread = null
        this.root.classList.remove('is-wiring')
        if (!d) return
        var neu = null
        if (!cancel && d.target) neu = d.moveTo ? [d.fixedPort, d.target.port] : [d.target.port, d.fixedPort]
        var same = neu && d.old && neu[0] === d.old[0] && neu[1] === d.old[1]
        var exists = neu && conns.some(function (c) { return c[0] === neu[0] && c[1] === neu[1] })
        if (cancel || same || (!neu && !d.old) || (exists && !d.old)) { this.render(); return }
        if (d.old) conns.splice(conns.indexOf(d.old), 1)
        if (neu && !exists) conns.push(neu)
        // a laid route doesn't fit its new ends
        if (d.old && this.o.wireRoutes) delete this.o.wireRoutes[d.old[0] + '>' + d.old[1]]
        // the cable keeps its colour
        var cols = this.o.wireColours
        if (cols && d.old && neu) {
            var oldKey = d.old[0] + '>' + d.old[1]
            if (cols[oldKey]) { cols[neu[0] + '>' + neu[1]] = cols[oldKey]; delete cols[oldKey] }
        }
        if (typeof this.o.onWire === 'function') this.o.onWire(d.old || null, exists ? null : neu)
        this.render()
    }

    // ---- cables laid by hand (faces) ------------------------------------------

    // a cable's own route, if it was laid by hand and still fits: its ends
    // follow the jacks (MOD's port tiles move with the view); a pedal that
    // moved since puts it back on the automatic way
    Surface.prototype.laid = function (c, auto, from, to) {
        var r = (this.o.wireRoutes || {})[c[0] + '>' + c[1]]
        if (!r || r.length < 4) return null
        var a0 = auto[0], a1 = auto[auto.length - 1], n = r.length
        if (from.kind === 'pedal' && Math.hypot(r[0][0] - a0[0], r[0][1] - a0[1]) > 3) return null
        if (to.kind === 'pedal' && Math.hypot(r[n - 1][0] - a1[0], r[n - 1][1] - a1[1]) > 3) return null
        var p = r.map(function (q) { return [q[0], q[1]] })
        p[0] = [a0[0], a0[1]]
        p[1][1] = a0[1]
        p[n - 1] = [a1[0], a1[1]]
        p[n - 2][1] = a1[1]
        return p
    }

    // the stretch of a cable nearest a point
    var nearestRun = function (p, q) {
        var best = 0, bestD = Infinity
        for (var i = 0; i < p.length - 1; i++) {
            var a = p[i], b = p[i + 1]
            var x = Math.max(Math.min(a[0], b[0]), Math.min(Math.max(a[0], b[0]), q.x))
            var y = Math.max(Math.min(a[1], b[1]), Math.min(Math.max(a[1], b[1]), q.y))
            var d = Math.hypot(x - q.x, y - q.y)
            if (d < bestD) { bestD = d; best = i }
        }
        return best
    }

    // corners that no longer turn go
    var tidy = function (p) {
        var out = [p[0]]
        for (var i = 1; i < p.length - 1; i++) {
            var a = out[out.length - 1], b = p[i], c = p[i + 1]
            var straight = (Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5)
            if (!straight) out.push(b)
        }
        out.push(p[p.length - 1])
        return out
    }

    // hold on a cable: its nearest stretch follows the pointer sideways. The
    // runs out of and into a jack can't leave it: moving one puts a short
    // jog in by the jack, and the rest of that run moves.
    Surface.prototype.beginBend = function (g, ci) {
        var c = this.o.connections[ci], drawn = this.wirePts && this.wirePts[ci]
        if (!c || !drawn) return false
        var p = drawn.map(function (q) { return [q[0], q[1]] }), q = this.toPlane(g.start)
        var i = nearestRun(p, q), n = p.length
        if (i === 0) {
            var dir = p[1][0] >= p[0][0] ? 1 : -1, J = Math.min(PAD, Math.abs(p[1][0] - p[0][0]) / 2) * dir
            p.splice(1, 0, [p[0][0] + J, p[0][1]], [p[0][0] + J, p[0][1]])
            i = 2
        } else if (i === n - 2) {
            var e = p[n - 1], dir2 = e[0] >= p[n - 2][0] ? 1 : -1, J2 = Math.min(PAD, Math.abs(e[0] - p[n - 2][0]) / 2) * dir2
            p.splice(n - 1, 0, [e[0] - J2, e[1]], [e[0] - J2, e[1]])
        }
        var vert = Math.abs(p[i][0] - p[i + 1][0]) < 0.5
        g.bend = { c: c, key: c[0] + '>' + c[1], pts: p, i: i, vert: vert, base: vert ? p[i][0] : p[i][1], q: q }
        this.o.wireRoutes = this.o.wireRoutes || {}
        this.o.wireRoutes[g.bend.key] = p
        this.root.classList.add('is-bending')
        this.renderWires()
        return true
    }

    Surface.prototype.bend = function (g, q) {
        var b = g.bend, p = this.toPlane(q), ax = b.vert ? 0 : 1
        var v = Math.round(b.base + (b.vert ? p.x - b.q.x : p.y - b.q.y))
        b.pts[b.i][ax] = v
        b.pts[b.i + 1][ax] = v
        this.renderWires()
    }

    Surface.prototype.endBend = function (g, cancel) {
        var b = g.bend
        this.root.classList.remove('is-bending')
        if (cancel) delete this.o.wireRoutes[b.key]
        else {
            this.o.wireRoutes[b.key] = tidy(b.pts)
            if (typeof this.o.onRoute === 'function') this.o.onRoute(b.c, this.o.wireRoutes[b.key])
        }
        this.renderWires()
    }

    // a tap on a plug: when its jack has several cables, they spread out
    // so the right one can be picked (as on MOD); a second tap gathers them
    Surface.prototype.tapPlug = function (hit) {
        var c = this.o.connections[+hit.getAttribute('data-ci')], end = hit.getAttribute('data-end')
        if (!c) return
        var port = c[end === 'to' ? 1 : 0], sp = this.spread
        if (sp && sp.port === port && sp.end === end) this.spread = null
        else if (this.shared(c, end)) this.spread = { port: port, end: end }
        else return
        this.renderWires()
    }

    // a tap on a cable: its colour
    Surface.prototype.pickColour = function (ci, q) {
        var self = this, c = this.o.connections[ci]
        this.closeColours()
        if (!c) return
        var box = this.n.colours = el('div', 'nhe-surface__colours', this.root)
        var current = this.colourOf(c)
        var set = function (colour) {
            var cols = self.o.wireColours = self.o.wireColours || {}, key = c[0] + '>' + c[1]
            if (colour) cols[key] = colour
            else delete cols[key]
            if (typeof self.o.onColour === 'function') self.o.onColour(c, colour)
            self.closeColours()
            self.renderWires()
        }
        var auto = el('button', 'nhe-surface__swatch is-auto' + (!current ? ' is-on' : ''), box)
        auto.type = 'button'
        auto.title = 'By its type (audio, MIDI, CV)'
        auto.addEventListener('click', function () { set(null) })
        COLOURS.forEach(function (col) {
            var b = el('button', 'nhe-surface__swatch' + (current === col ? ' is-on' : ''), box)
            b.type = 'button'
            b.style.background = col
            b.setAttribute('aria-label', col)
            b.addEventListener('click', function () { set(col) })
        })
        if ((this.o.wireRoutes || {})[c[0] + '>' + c[1]]) {
            var reset = el('button', 'nhe-surface__unlay', box)
            reset.type = 'button'
            reset.textContent = 'Automatic route'
            reset.addEventListener('click', function () {
                delete self.o.wireRoutes[c[0] + '>' + c[1]]
                if (typeof self.o.onRoute === 'function') self.o.onRoute(c, null)
                self.closeColours()
                self.renderWires()
            })
        }
        var W = this.root.clientWidth, Hh = this.root.clientHeight
        box.style.left = Math.max(8, Math.min(W - box.offsetWidth - 8, q.x - box.offsetWidth / 2)) + 'px'
        box.style.top = (q.y + 20 + box.offsetHeight < Hh ? q.y + 20 : Math.max(8, q.y - 20 - box.offsetHeight)) + 'px'
    }

    Surface.prototype.closeColours = function () {
        if (this.n.colours && this.n.colours.parentNode) this.n.colours.parentNode.removeChild(this.n.colours)
        this.n.colours = null
    }

    // ---- pan and zoom ------------------------------------------------------

    Surface.prototype.apply = function () {
        var v = this.view
        // zoomed well out from a live face: it lets go
        if (this.focused && v.z < this.focused.z * 0.75) this.blur()
        this.n.plane.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')'
        // the board's surface moves and zooms with it
        this.root.style.backgroundPosition = (v.x + this.bg.x * v.z) + 'px ' + (v.y + this.bg.y * v.z) + 'px'
        this.root.style.backgroundSize = 'auto ' + (this.tile * v.z) + 'px'
        // for what stays screen-sized on the plane (a card's plug button)
        this.root.style.setProperty('--nhe-surface-z', v.z)
        this.placePorts()
        this.renderWires()
    }

    // MOD's ports: against the screen's edges, each side's ports stacked
    // (in their rows' order) and centred in the view, so panning up and
    // down never takes them away
    Surface.prototype.portTop = function (nd) {
        var side = this.o.nodes.filter(function (o) { return o.kind === nd.kind && o.cell })
            .sort(function (a, b) { return a.cell.row - b.cell.row })
        var tall = (side.length - 1) * PORT_STEP + PORT + PORT_LABEL
        var top = Math.max(0, (this.root.clientHeight - tall) / 2)
        if (nd.kind === 'output' && this.zoomClear) top = this.zoomClear(top, tall)
        return top + side.indexOf(nd) * PORT_STEP
    }
    // zoomRight: the outputs keep clear of the zoom buttons at the right edge,
    // below them (above, when they sit at the bottom); where there's no room
    // for that, the buttons stand left of the tiles instead (is-zoom-beside)
    Surface.prototype.zoomRoom = function () {
        var zm = this.n && this.n.zoom, root = this.root
        this.zoomClear = null
        if (!this.o.zoomRight || !zm) return
        root.classList.remove('is-zoom-beside')
        var Hh = root.clientHeight, zt = zm.offsetTop, zb = zt + zm.offsetHeight
        var n = this.o.nodes.filter(function (o) { return o.kind === 'output' && o.cell }).length
        if (!n || !zm.offsetHeight) return
        var tall = (n - 1) * PORT_STEP + PORT + PORT_LABEL
        var below = zt < Hh / 2
        if (below ? zb + ZOOM_GAP + tall > Hh : zt - ZOOM_GAP - tall < 0) { root.classList.add('is-zoom-beside'); return }
        this.zoomClear = function (top) { return below ? Math.max(top, zb + ZOOM_GAP) : Math.min(top, zt - ZOOM_GAP - tall) }
    }
    Surface.prototype.placePorts = function () {
        var self = this
        this.zoomRoom()
        ;(this.portEls || []).forEach(function (p) { p.el.style.top = self.portTop(p.node) + 'px' })
    }

    // does any wire reach this node?
    Surface.prototype.connected = function (nd) {
        var self = this
        return this.o.connections.some(function (c) { return self.ownerOf(c[0]) === nd || self.ownerOf(c[1]) === nd })
    }

    // can a wire be drawn between one of MOD's ports and a pedal? Not when
    // the pedal runs into the port's tile (or its label), its connecting
    // side is off screen, or it is off screen above or below
    Surface.prototype.clearOf = function (port, b) {
        var v = this.view, W = this.root.clientWidth, Hh = this.root.clientHeight
        var x1 = v.x + b.x * v.z, y1 = v.y + b.y * v.z, x2 = x1 + b.w * v.z, y2 = y1 + b.h * v.z
        if (y2 <= 0 || y1 >= Hh) return false
        var tx1 = port.kind === 'input' ? (this.inL || 0) + SIDE : W - (this.inR || 0) - SIDE - PORT, tx2 = tx1 + PORT
        var ty1 = this.portTop(port), ty2 = ty1 + PORT + PORT_LABEL
        if (x1 < tx2 && x2 > tx1 && y1 < ty2 && y2 > ty1) return false
        return port.kind === 'input' ? x1 >= 0 : x2 <= W
    }

    // pan no further than the grid: its first column just clear of the port
    // tiles on the left; on the right past its last column by RIGHT_ROOM,
    // where the cables run down to MOD's outputs (on a phone they ran off
    // the screen); its top row at the top and the Expand strip at the
    // bottom. A grid smaller than the screen stays put at the top left.
    Surface.prototype.clamp = function (v) {
        v = v || this.view
        var W = this.root.clientWidth, Hh = this.root.clientHeight
        var maxX = this.gapL() - EDGE * v.z, minX = W - this.gapR() - (EDGE + this.cols * CELL + RIGHT_ROOM) * v.z
        var maxY = HEAD, minY = Hh - (this.rows * CELL + FOOT) * v.z
        v.x = Math.max(Math.min(maxX, minX), Math.min(maxX, v.x))
        v.y = Math.max(Math.min(maxY, minY), Math.min(maxY, v.y))
        return v
    }

    Surface.prototype.zoomAt = function (px, py, z) {
        var v = this.view
        z = Math.max(ZMIN, Math.min(ZMAX, z))
        v.x = px - (px - v.x) * (z / v.z)
        v.y = py - (py - v.y) * (z / v.z)
        v.z = z
        this.clamp()
        this.apply()
    }

    // zoom so a pedal's face shows at its full size (faceSize, else its
    // picture's), centred; then it goes live (liveFace)
    Surface.prototype.focus = function (nd) {
        var self = this, d = this.els[nd.id], img = d && d.querySelector('img')
        var v = this.view, r = this.root.getBoundingClientRect()
        if (this.focused && this.focused.id !== nd.id) this.blur()
        // the picture at FOCUS x its own size: the pedal in it at 120%
        var z = 1.5
        if (img && img.naturalWidth) z = FOCUS * img.naturalWidth / (img.getBoundingClientRect().width / this.scale() / v.z)
        var W = this.root.clientWidth, Hh = this.root.clientHeight
        var b = this.box(nd), cx = b.x + b.w / 2, cy = b.y + b.h / 2
        // the pedal itself (within its picture), with its gear above and its
        // name below, always fits the view: a small screen zooms in less
        if (img && img.offsetWidth && d) {
            var a = this.inner(nd, img, img.offsetWidth, img.offsetHeight)
            var top = parseFloat(d.style.top) + img.offsetTop + a.y, left = parseFloat(d.style.left) + img.offsetLeft + a.x
            var side = this.gapL() + this.gapR()                      // MOD's port tiles, each side
            var fit = Math.min((W - side) / a.w, (Hh - FIT_ABOVE - FIT_BELOW) / a.h)
            if (fit > 0) z = Math.min(z, fit)
            cx = left + a.w / 2
            // centred between the gear's room above and the name's below
            cy = top + a.h / 2 + (FIT_BELOW - FIT_ABOVE) / 2 / z
        }
        z = Math.max(ZMIN, Math.min(ZMAX, z))
        // centred, as far as the grid's edges allow
        this.animate(this.clamp({ x: W / 2 - cx * z, y: Hh / 2 - cy * z, z: z }), function () {
            self.focused = { id: nd.id, z: self.view.z }
            self.mountLive()
            if (typeof self.o.onFocus === 'function') self.o.onFocus(nd)
        })
    }

    // the gear sits at the pedal's own top right corner (within its picture),
    // the name and maker right under its bottom edge
    Surface.prototype.placeGear = function (nd) {
        var d = this.els && this.els[nd.id]
        var gear = d && d.querySelector('.nhe-surface__gear'), lab = d && d.querySelector('.nhe-surface__caption'), perf = d && d.querySelector('.nhe-surface__perf'), plug = d && d.querySelector('.nhe-surface__plugbtn')
        var img = d && d.querySelector('.nhe-surface__face img')
        if (!gear && !lab) return
        if (!img || !img.complete || !img.offsetWidth) {
            ;[gear, perf, plug].forEach(function (b) { if (b) { b.style.left = '100%'; b.style.top = '0' } })
            return
        }
        var a = this.inner(nd, img, img.offsetWidth, img.offsetHeight)
        ;[gear, perf, plug].forEach(function (b) {
            if (!b) return
            b.style.left = (img.offsetLeft + a.x + a.w) + 'px'
            b.style.top = (img.offsetTop + a.y) + 'px'
        })
        if (lab) lab.style.top = (img.offsetTop + a.y + a.h) + 'px'
    }

    // the working GUIs over the pictures (again after a redraw): the
    // focused face's, or with liveAll every face's. Not while released.
    Surface.prototype.mountLive = function () {
        var self = this, f = this.focused
        if (f && (!this.els[f.id] || !this.node(f.id))) f = this.focused = null
        if (f) this.els[f.id].classList.add('is-focused')       // its gear larger, the performance view's bolt beside it
        if (this.released) return
        if (this.o.liveAll && this.faces) this.o.nodes.forEach(function (nd) { if (nd.kind === 'pedal' && nd.cell && self.els[nd.id]) self.mountFace(nd) })
        else if (f) this.mountFace(this.node(f.id))
    }
    Surface.prototype.mountFace = function (nd) {
        var d = this.els[nd.id], self = this
        var img = d && d.querySelector('.nhe-surface__face img')
        if (!img || typeof this.o.liveFace !== 'function') return
        // a redrawn face's picture may not be in yet: it has no size until it is
        if (!img.complete || !img.offsetWidth) {
            if (!img.__nheWaiting) { img.__nheWaiting = true; img.addEventListener('load', function () { if (self.els[nd.id] === d) self.mountLive() }) }
            return
        }
        if (d.classList.contains('is-live')) return              // showing it already
        // over the pedal within the picture
        var layer = d.querySelector('.nhe-surface__live') || el('div', 'nhe-surface__live', d)
        var a = this.inner(nd, img, img.offsetWidth, img.offsetHeight)
        layer.style.left = (img.offsetLeft + a.x) + 'px'
        layer.style.top = (img.offsetTop + a.y) + 'px'
        layer.style.width = a.w + 'px'
        layer.style.height = a.h + 'px'
        d.classList.toggle('is-live', !!this.o.liveFace(nd, layer))
    }
    // a face lets go of its working GUI (onBlur takes it back)
    Surface.prototype.unmount = function (nd) {
        var d = nd && this.els[nd.id]
        if (typeof this.o.onBlur === 'function' && nd) this.o.onBlur(nd)
        if (!d) return
        d.classList.remove('is-live')
        var layer = d.querySelector('.nhe-surface__live')
        if (layer) layer.parentNode.removeChild(layer)
    }

    // the focused face stops playing; without liveAll it shows its picture again
    Surface.prototype.blur = function () {
        var f = this.focused
        if (!f) return
        this.focused = null
        var d = this.els[f.id], nd = this.node(f.id)
        if (d) d.classList.remove('is-focused')
        if (!(this.o.liveAll && this.faces)) this.unmount(nd)
    }

    // every working GUI given back (the performance view, MOD's builder or
    // a new board takes them), until resume()
    Surface.prototype.release = function () {
        var self = this
        this.blur()
        this.released = true
        this.o.nodes.forEach(function (nd) { var d = self.els[nd.id]; if (d && d.classList.contains('is-live')) self.unmount(nd) })
    }
    Surface.prototype.resume = function () {
        this.released = false
        this.mountLive()
    }

    // a card's red dot (top left): the plugin is on
    Surface.prototype.setOn = function (id, on) {
        var nd = this.node(id), d = this.els[id]
        if (nd) nd.on = on
        if (d) d.classList.toggle('is-on', !!on)
    }

    // a press on a live face's controls is the GUI's, not the surface's: the
    // focused face's, or with liveAll any face's (as on MOD's builder). On the
    // rest of a face a press pans, lifts, or (a tap) zooms in on it
    Surface.prototype.onLive = function (target) {
        var f = this.focused
        if (typeof this.o.isControl !== 'function') return false
        var layer = target.closest && target.closest('.nhe-surface__live')
        if (!layer) return false
        if (!(this.o.liveAll && this.faces) && (!f || layer.parentNode !== this.els[f.id])) return false
        return this.o.isControl(target)
    }

    // zoom out until the whole grid shows (a double click on the surface)
    Surface.prototype.fit = function () {
        var W = this.root.clientWidth, Hh = this.root.clientHeight
        var z = Math.min((W - this.gapL() - this.gapR()) / (this.cols * CELL), (Hh - HEAD) / (this.rows * CELL + FOOT))
        z = Math.max(ZMIN, Math.min(1, z))
        this.blur()
        this.animate(this.clamp({ x: this.gapL() - EDGE * z, y: HEAD, z: z }))
    }

    Surface.prototype.animate = function (to, done) {
        var self = this, v = this.view, from = { x: v.x, y: v.y, z: v.z }, t0 = null, MS = 260
        var step = function (t) {
            if (t0 === null) t0 = t
            var k = Math.min(1, (t - t0) / MS), e = 1 - Math.pow(1 - k, 3)
            v.x = from.x + (to.x - from.x) * e
            v.y = from.y + (to.y - from.y) * e
            v.z = from.z + (to.z - from.z) * e
            self.apply()
            if (k < 1) requestAnimationFrame(step)
            else if (done) done()
        }
        requestAnimationFrame(step)
    }

    Surface.prototype.wheel = function (e) {
        if (this.onLive(e.target)) return
        e.preventDefault()
        var r = this.root.getBoundingClientRect(), k = this.scale()
        if (e.ctrlKey) this.zoomAt((e.clientX - r.left) / k, (e.clientY - r.top) / k, this.view.z * Math.exp(-e.deltaY * 0.01))
        else { this.view.x -= e.deltaX / k; this.view.y -= e.deltaY / k; this.clamp(); this.apply() }
    }

    // how much the page scales the surface on screen (NHE.zoom on a phone):
    // screen px per surface px; pointers are measured in screen px
    Surface.prototype.scale = function () { return (this.root.getBoundingClientRect().width / this.root.clientWidth) || 1 }

    // ---- pointers: pan, pinch, tap, long-press move ------------------------

    Surface.prototype.pointers = function () {
        var self = this, root = this.root, down = {}, g = null
        var local = function (e) { var r = root.getBoundingClientRect(), k = self.scale(); return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k } }
        var pts = function () { return Object.keys(down).map(function (k) { return down[k] }) }

        root.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return
            if (e.target.closest('.nhe-surface__zoom') || e.target.closest('.nhe-surface__colours') || e.target.closest('.nhe-surface__cvtag')) return
            // the live face's knobs and switches: theirs
            if (self.onLive(e.target)) return
            self.closeColours()
            // a tap anywhere but on a spread jack's plugs gathers them again
            if (self.spread && !e.target.closest('.nhe-surface__plug')) { self.spread = null; self.renderWires() }
            down[e.pointerId] = local(e)
            var p = pts()
            if (p.length === 2) {
                // a second finger: pinch-zoom, whatever the first was doing
                if (g && g.timer) clearTimeout(g.timer)
                if (g && g.lifted) self.drop(g, true)
                if (g && g.mode === 'wire' && g.moved) self.dropWire(true)
                var a = p[0], b = p[1]
                g = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), z: self.view.z }
                return
            }
            if (p.length > 2) return
            // a cable started by a tap on a port tile: this press puts its end down
            if (self.sticky) {
                delete down[e.pointerId]
                self.sticky = false
                self.dragWire(local(e))
                self.dropWire(false)
                self.moved = true
                setTimeout(function () { self.moved = false }, 0)
                return
            }
            // a plug, a socket or one of MOD's port tiles (faces): hand wiring
            var hit = self.faces && e.target.closest('.nhe-surface__plug, .nhe-surface__socket, .nhe-surface__item.is-port')
            if (hit) {
                g = { mode: 'wire', start: local(e), hit: hit, moved: false }
                self.moved = false
                return
            }
            // a card's plug button is a button, not the card (no tap, no long-press)
            var item = !e.target.closest('.nhe-surface__rewire, .nhe-surface__gear, .nhe-surface__plugbtn, .nhe-surface__perf') && e.target.closest('.nhe-surface__item.is-pedal')
            var cable = self.faces && e.target.closest('.nhe-surface__wire-hit')
            // cards (phones): a tap on one of MOD's port tiles is reported (onPortTap)
            var tile = !self.faces && e.target.closest('.nhe-surface__item.is-port')
            g = { mode: 'press', start: local(e), view: { x: self.view.x, y: self.view.y }, item: item, cable: cable, tile: tile, moved: false }
            self.moved = false
            if (item) {
                g.timer = setTimeout(function () { if (g && g.mode === 'press' && !g.moved) self.lift(g) }, LONG_MS)
            } else if (cable) {
                // press and hold a cable: drag that stretch of it elsewhere
                g.timer = setTimeout(function () {
                    if (!g || g.mode !== 'press' || g.moved) return
                    if (self.beginBend(g, +cable.getAttribute('data-cable'))) {
                        g.mode = 'bend'
                        g.moved = self.moved = true
                        if (navigator.vibrate) { try { navigator.vibrate(15) } catch (e) {} }
                    }
                }, LONG_MS)
            }
        })

        // moves and releases are followed on the window (no pointer capture:
        // it would take the click away from a + under the finger)
        window.addEventListener('pointermove', function (e) {
            if (self.sticky && !down[e.pointerId]) { self.dragWire(local(e)); return }
            if (!down[e.pointerId] || !g) return
            down[e.pointerId] = local(e)
            var p = pts()
            if (g.mode === 'pinch' && p.length === 2) {
                var a = p[0], b = p[1], d = Math.hypot(a.x - b.x, a.y - b.y)
                if (g.dist) self.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, g.z * d / g.dist)
                return
            }
            var q = local(e), dx = q.x - g.start.x, dy = q.y - g.start.y
            if (g.mode === 'lifted') { self.drag(g, q); return }
            if (g.mode === 'bend') { self.bend(g, q); return }
            if (g.mode === 'wire') {
                if (!g.moved && Math.max(Math.abs(dx), Math.abs(dy)) > SLOP) { g.moved = self.moved = true; if (self.beginWire(g) === false) { g = null; return } }
                if (g.moved) self.dragWire(q)
                return
            }
            if (!g.moved && Math.max(Math.abs(dx), Math.abs(dy)) > SLOP) {
                g.moved = true
                self.moved = true
                if (g.timer) clearTimeout(g.timer)
            }
            if (g.moved) {
                self.view.x = g.view.x + dx
                self.view.y = g.view.y + dy
                self.clamp()
                self.apply()
            }
        })

        var end = function (e) {
            if (!down[e.pointerId]) return
            delete down[e.pointerId]
            if (!g) return
            if (g.timer) clearTimeout(g.timer)
            if (g.mode === 'lifted') { self.drop(g, e.type === 'pointercancel'); g = null; return }
            if (g.mode === 'bend') { self.endBend(g, e.type === 'pointercancel'); g = null; setTimeout(function () { self.moved = false }, 0); return }
            if (g.mode === 'pinch') { if (!pts().length) g = null; return }
            if (g.mode === 'wire') {
                if (g.moved) self.dropWire(e.type === 'pointercancel')
                else if (g.hit && g.hit.hasAttribute('data-ci') && e.type === 'pointerup') self.tapPlug(g.hit)
                // a tap on a port tile (or a free jack): a cable follows the pointer
                // until the next press puts its end down (Escape lets go)
                else if (g.hit && !g.hit.hasAttribute('data-ci') && e.type === 'pointerup' && self.beginWire(g) !== false) {
                    self.sticky = true
                    self.dragWire(local(e))
                }
                g = null
                if (self.moved) setTimeout(function () { self.moved = false }, 0)
                return
            }
            // a tap on a pedal (no move, no long-press): a face zooms in to its
            // full size; a card reports it
            // a tap on a cable (faces): its colour
            if (g.cable && !g.moved && e.type === 'pointerup') self.pickColour(+g.cable.getAttribute('data-cable'), local(e))
            if (g.tile && !g.moved && e.type === 'pointerup' && typeof self.o.onPortTap === 'function') {
                var pn = self.node(g.tile.getAttribute('data-id'))
                if (pn) self.o.onPortTap(pn, self.connected(pn))
            }
            if (g.item && !g.moved && e.type === 'pointerup') {
                var nd = self.node(g.item.getAttribute('data-id'))
                if (nd && self.faces) { if (!self.focused || self.focused.id !== nd.id) self.focus(nd) }
                else if (nd && typeof self.o.onTap === 'function') self.o.onTap(nd)
            }
            g = null
            // a pan isn't a tap on whatever it ended on
            if (self.moved) setTimeout(function () { self.moved = false }, 0)
        }
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
        window.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && self.sticky) { self.sticky = false; self.dropWire(true) }
        })

        // a double click on the surface itself (not a pedal, a +, a cable…): the whole grid
        root.addEventListener('dblclick', function (e) {
            if (e.target.closest('.nhe-surface__item, .nhe-surface__plus, .nhe-surface__expand, .nhe-surface__zoom, .nhe-surface__colours, .nhe-surface__cvtag, .nhe-surface__plug, .nhe-surface__socket, .nhe-surface__wire-hit, .nhe-surface__insert')) return
            e.preventDefault()
            self.fit()
        })
    }

    Surface.prototype.node = function (id) { return this.o.nodes.filter(function (x) { return x.id === id })[0] }

    // the long-press: the pedal lifts and follows the pointer
    Surface.prototype.lift = function (g) {
        var nd = this.node(g.item.getAttribute('data-id'))
        if (!nd) return
        if (this.focused && this.focused.id === nd.id) this.blur()
        g.mode = 'lifted'
        g.node = nd
        // where it is drawn (a face is larger than its box)
        var b = this.box(nd), dx = parseFloat(g.item.style.left) - b.x, dy = parseFloat(g.item.style.top) - b.y
        g.box = { x: b.x, y: b.y, w: b.w, h: b.h, dx: dx, dy: dy }
        g.item.classList.add('is-lifted')
        this.root.classList.add('is-moving')
        if (navigator.vibrate) { try { navigator.vibrate(15) } catch (e) {} }
    }

    Surface.prototype.drag = function (g, q) {
        var v = this.view, dx = (q.x - g.start.x) / v.z, dy = (q.y - g.start.y) / v.z
        g.item.style.left = (g.box.x + g.box.dx + dx) + 'px'
        g.item.style.top = (g.box.y + g.box.dy + dy) + 'px'
        // the cell it would land in
        var s = this.span(g.node)
        var col = Math.round((g.box.x + dx - PAD - EDGE) / CELL), row = Math.round((g.box.y + dy - PAD) / CELL)
        col = Math.max(0, Math.min(this.cols - s.w, col))
        row = Math.max(0, Math.min(this.rows - s.h, row))
        g.target = { col: col, row: row, ok: this.fits(g.node, col, row) }
        this.showTarget(g.target, s)
    }

    Surface.prototype.showTarget = function (t, s) {
        var m = this.n.target || (this.n.target = el('div', 'nhe-surface__target', this.n.cells))
        if (!t) { m.style.display = 'none'; return }
        m.style.display = 'block'
        m.classList.toggle('is-blocked', !t.ok)
        m.style.left = (this.cellX(t.col) + 6) + 'px'
        m.style.top = (this.cellY(t.row) + 6) + 'px'
        m.style.width = (s.w * CELL - 12) + 'px'
        m.style.height = (s.h * CELL - 12) + 'px'
    }

    // drop: on a free cell it moves (wiring kept); anywhere else it goes back
    Surface.prototype.drop = function (g, cancel) {
        this.root.classList.remove('is-moving')
        if (this.n.target) this.n.target.style.display = 'none'
        var t = g.target, nd = g.node
        var same = t && t.col === nd.cell.col && t.row === nd.cell.row
        if (!cancel && t && t.ok && !same) {
            nd.cell = { col: t.col, row: t.row }
            if (typeof this.o.onMove === 'function') this.o.onMove(nd, nd.cell)
        }
        this.render()
    }

    NHE.Surface = Surface
    NHE.Surface.CELL = CELL
})();
