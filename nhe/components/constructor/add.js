// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * The constructor's + dialog (docs/constructor-spec.md): pick a pedal, what
 * feeds it and where it goes; the ports are wired automatically
 * (autowire.js). Full screen on a phone (NHE.zoom), a large card elsewhere.
 * Needs controls.js / .css and autowire.js.
 *
 *   NHE.AddPedalDialog({
 *       categories: [{ id, label }],          // the tabs after Favourites and All
 *       plugins: [{ uri, name, brand, categories: [id], favourite, thumb, ports }],
 *       loadPorts: fn(plugin, done),          // when a plugin comes without ports:
 *                                             // fill plugin.ports, then call done()
 *       loadInfo: fn(plugin, done),           // for the info page: fill plugin.info
 *                                             // { comment, author, homepage, version,
 *                                             //   license, screenshot, badge, onlineHref,
 *                                             //   controls / cvInputs / cvOutputs:
 *                                             //   [{ name, default, minimum, maximum }] }
 *                                             // (and ports), then done()
 *       onFavourite: fn(plugin, on),          // the info page's star (MOD's favourites)
 *       nodes: [{ id, name, brand, thumb, kind: 'pedal' | 'input' | 'output',
 *                 icon, channel, ports,
 *                 cell: { col, row } }],      // what is on the surface, and MOD's ports
 *       near: { col, row },                   // the + that was tapped: the nodes
 *                                             // nearest it come first on the sides
 *       connections: [[fromPort, toPort]],
 *       onPlace: fn({ plugin, inputs: [nodeId], outputs: [nodeId], plan }),
 *       onCancel: fn()
 *   })
 *
 * A plugin's ports are symbols ({ audio: { in: ['in_l', 'in_r'], out: [...] } });
 * in the plan the new pedal's ports read NEW + '/' + symbol (NHE.AddPedalDialog.NEW),
 * for the caller to swap for the instance it creates.
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon
    var NEW = '{new}'

    // the plugin as a node, its ports named NEW/symbol
    var asNode = function (plugin) {
        var ports = {}
        ;['audio', 'midi', 'cv'].forEach(function (t) {
            var p = (plugin.ports && plugin.ports[t]) || {}
            ports[t] = {
                in: (p.in || []).map(function (s) { return NEW + '/' + s }),
                out: (p.out || []).map(function (s) { return NEW + '/' + s })
            }
        })
        return { id: NEW, ports: ports }
    }

    var Dialog = function (options) {
        var self = this
        this.o = mix({ categories: [], plugins: [], nodes: [], connections: [] }, options || {})
        this.tab = 'favourites'
        this.query = ''
        this.plugin = null
        this.inputs = {}
        this.outputs = {}

        var full = NHE.zoom && NHE.zoom() > 1
        var overlay = this.overlay = el('div', 'nhe-ctl nhe-dialog-overlay nhe-add-overlay' + (full ? ' is-full' : ''), document.body)
        var d = this.root = el('div', 'nhe-add' + (full ? ' is-full' : ''), overlay)
        d.setAttribute('role', 'dialog')
        d.setAttribute('aria-modal', 'true')
        d.setAttribute('aria-label', 'Add a pedal')
        d.setAttribute('tabindex', '-1')

        var n = this.n = {}
        n.tabs = el('div', 'nhe-add__tabs', d)
        var search = el('div', 'nhe-add__search', d)
        n.search = el('input', 'nhe-dialog__input', search)
        n.search.type = 'text'
        n.search.placeholder = 'Search'
        n.search.setAttribute('aria-label', 'Search pedals')
        n.search.setAttribute('autocomplete', 'off')
        n.search.setAttribute('spellcheck', 'false')
        n.clear = el('button', 'nhe-add__clear', search, icon('close'))
        n.clear.type = 'button'
        n.clear.setAttribute('aria-label', 'Clear the search')
        n.search.addEventListener('input', function () { self.query = n.search.value; self.renderResults() })
        n.clear.addEventListener('click', function () { n.search.value = ''; self.query = ''; self.renderResults(); n.search.focus() })

        var cols = el('div', 'nhe-add__columns', d)
        var col = function (cls) {
            var c = el('div', 'nhe-add__col nhe-add__col--' + cls, cols)
            var t = el('div', 'nhe-add__title', c)
            var l = el('div', 'nhe-add__list', c)
            return { title: t, list: l, col: c }
        }
        n.in = col('in')
        n.res = col('results')
        n.out = col('out')
        n.in.title.textContent = 'Input from'
        n.out.title.textContent = 'Output to'
        // the results scroll a page at a time with the arrows, or by drag
        n.up = el('button', 'nhe-add__arrow nhe-add__arrow--up', n.res.col, icon('arrowUp'))
        n.down = el('button', 'nhe-add__arrow nhe-add__arrow--down', n.res.col, icon('arrowDown'))
        ;[[n.up, -1], [n.down, 1]].forEach(function (a) {
            a[0].type = 'button'
            a[0].setAttribute('aria-label', a[1] < 0 ? 'Scroll up' : 'Scroll down')
            a[0].addEventListener('click', function () { n.res.list.scrollTop += a[1] * (n.res.list.clientHeight - 60) })
        })
        n.res.list.addEventListener('scroll', function () { self.renderArrows() }, { passive: true })

        var foot = el('div', 'nhe-add__foot', d)
        n.summary = el('div', 'nhe-add__summary', foot)
        var buttons = el('div', 'nhe-dialog__buttons', foot)
        buttons.appendChild(NHE.textButton('Cancel', 'secondary', function () { self.cancel() }))
        n.place = NHE.textButton('Place', 'primary', function () { self.place() })
        buttons.appendChild(n.place)

        d.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return
            e.preventDefault(); e.stopPropagation()
            if (self.n.info) self.hideInfo()      // Escape on the info page goes back
            else self.cancel()
        })
        d.addEventListener('keyup', function (e) { e.stopPropagation() })
        NHE.dragScroll(d)
        NHE.dragScroll(n.tabs, { x: true })

        this.renderTabs()
        this.renderResults()
        this.renderSides()
        setTimeout(function () { d.focus() }, 0)
    }

    var count = function (plugins, fn) { return plugins.filter(fn).length }

    Dialog.prototype.inTab = function (p) {
        if (this.tab === 'favourites') return !!p.favourite
        if (this.tab === 'all') return true
        return (p.categories || []).indexOf(this.tab) >= 0
    }

    Dialog.prototype.renderTabs = function () {
        var self = this, o = this.o, box = this.n.tabs
        box.innerHTML = ''
        var tabs = [{ id: 'favourites', label: 'Favourites' }, { id: 'all', label: 'All' }].concat(o.categories)
        tabs.forEach(function (t) {
            var all = count(o.plugins, function (p) { var keep = self.tab; self.tab = t.id; var r = self.inTab(p); self.tab = keep; return r })
            if (!all && t.id !== 'favourites' && t.id !== 'all') return
            var b = el('button', 'nhe-add__tab' + (t.id === self.tab ? ' is-active' : ''), box)
            b.type = 'button'
            el('span', null, b).textContent = t.label
            if (t.id !== 'favourites') el('small', null, b).textContent = '(' + all + ')'
            b.addEventListener('click', function () { self.tab = t.id; self.renderTabs(); self.renderResults() })
        })
    }

    Dialog.prototype.matches = function () {
        var self = this, q = this.query.toLowerCase().replace(/^\s+|\s+$/g, '')
        return this.o.plugins.filter(function (p) {
            // a search looks through every pedal, not just the tab
            if (q) return (p.name + ' ' + (p.brand || '')).toLowerCase().indexOf(q) >= 0
            return self.inTab(p)
        })
    }

    var thumb = function (parent, item, cls) {
        var t = el('div', 'nhe-add__thumb' + (cls ? ' ' + cls : ''), parent)
        if (item.thumb) {
            var img = el('img', null, t)
            img.alt = ''
            img.src = item.thumb
            img.draggable = false
        } else if (item.icon) {
            t.classList.add('is-port')
            t.innerHTML = icon(item.icon)
        } else {
            // no picture: a tile in the pedal's colour with its initials
            t.classList.add('is-blank')
            t.style.setProperty('--tile', item.colour || '#555')
            t.textContent = (item.name || '?').split(/\s+/).map(function (w) { return w[0] }).join('').slice(0, 3).toUpperCase()
        }
        return t
    }

    var card = function (parent, item, picked, onTap, mark, onInfo) {
        var b = el('button', 'nhe-add__card' + (picked ? ' is-picked' : ''), parent)
        b.type = 'button'
        b.setAttribute('aria-pressed', picked ? 'true' : 'false')
        var t = thumb(b, item)
        if (mark === 'tick') el('span', 'nhe-add__tick', t, icon('tick'))
        // the pedal's info: where the tick sits on the side columns
        if (onInfo) {
            var i = el('span', 'nhe-add__info', t, icon('info'))
            i.setAttribute('role', 'button')
            i.setAttribute('aria-label', 'About ' + item.name)
            i.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); onInfo() })
        }
        el('span', 'nhe-add__name', b).textContent = item.name
        if (item.brand) el('span', 'nhe-add__brand', b).textContent = item.brand
        b.addEventListener('click', onTap)
        return b
    }

    Dialog.prototype.renderResults = function () {
        var self = this, n = this.n, list = n.res.list
        var q = this.query.replace(/^\s+|\s+$/g, '')
        var tab = this.tab === 'favourites' ? 'Favourites' : this.tab === 'all' ? 'All pedals' : ((this.o.categories.filter(function (c) { return c.id === self.tab })[0] || {}).label || '')
        n.res.title.textContent = q ? 'Results for ' + q : tab
        list.innerHTML = ''
        var found = this.matches()
        if (!found.length) el('div', 'nhe-add__empty', list).textContent = q ? 'No pedals match.' : 'Nothing here yet.'
        found.forEach(function (p) {
            card(list, p, self.plugin === p, function () { self.pick(self.plugin === p ? null : p) }, 'ring', function () { self.showInfo(p) })
        })
        list.scrollTop = 0
        this.renderArrows()
    }

    Dialog.prototype.renderArrows = function () {
        var l = this.n.res.list
        this.n.up.classList.toggle('is-shown', l.scrollTop > 2)
        this.n.down.classList.toggle('is-shown', l.scrollTop + l.clientHeight < l.scrollHeight - 2)
    }

    // the pedal first: the side columns then show what can connect to it
    Dialog.prototype.pick = function (plugin) {
        var self = this
        // ports can come later (MOD gives them per plugin): fetch, then pick
        if (plugin && !plugin.ports && typeof this.o.loadPorts === 'function') {
            this.o.loadPorts(plugin, function () { if (self.overlay) self.pick(plugin.ports ? plugin : null) })
            return
        }
        this.plugin = plugin
        var node = plugin && asNode(plugin), keep = {}
        // keep picks that still fit the new pedal
        for (var id in this.inputs) if (node && NHE.autowire.canFeed(this.node(id), node)) keep[id] = true
        this.inputs = keep
        keep = {}
        for (id in this.outputs) if (node && NHE.autowire.canTake(this.node(id), node)) keep[id] = true
        this.outputs = keep
        var cards = this.n.res.list.querySelectorAll('.nhe-add__card'), found = this.matches()
        for (var i = 0; i < cards.length; i++) {
            var on = found[i] === plugin
            cards[i].classList.toggle('is-picked', on)
            cards[i].setAttribute('aria-pressed', on ? 'true' : 'false')
        }
        this.renderSides()
    }

    Dialog.prototype.node = function (id) {
        return this.o.nodes.filter(function (x) { return x.id === id })[0]
    }

    Dialog.prototype.renderSides = function () {
        var self = this, n = this.n, node = this.plugin && asNode(this.plugin)
        var side = function (c, kind, picked, test) {
            c.list.innerHTML = ''
            c.col.classList.toggle('is-waiting', !node)
            if (!node) { el('div', 'nhe-add__empty', c.list).textContent = 'Pick a pedal first.'; return }
            var any = false
            // the Input from column lists sources (their outs), Output to targets (their ins)
            self.sorted(kind === 'output' ? 'out' : 'in').forEach(function (x) {
                if (x.kind === kind || !test(x, node)) return
                any = true
                card(c.list, x, !!picked[x.id], function () {
                    if (picked[x.id]) delete picked[x.id]
                    else picked[x.id] = true
                    self.renderSides()
                }, 'tick')
            })
            if (!any) el('div', 'nhe-add__empty', c.list).textContent = 'Nothing can connect here.'
        }
        side(n.in, 'output', this.inputs, NHE.autowire.canFeed)
        side(n.out, 'input', this.outputs, NHE.autowire.canTake)
        this.renderSummary()
    }

    // Nearest the tapped + first (grid steps across plus down). On a tie,
    // what sits before it (to the left) leads the inputs, what sits after it
    // leads the outputs. Without a + to go by, the surface's own order.
    Dialog.prototype.sorted = function (side) {
        var near = this.o.near, nodes = this.o.nodes.slice()
        if (!near) return nodes
        var rank = function (x, i) {
            if (!x.cell) return [1e6, 0, i]
            var dx = x.cell.col - near.col, dy = x.cell.row - near.row
            var wrongSide = side === 'out' ? (dx > 0 ? 1 : 0) : (dx < 0 ? 1 : 0)
            return [Math.abs(dx) + Math.abs(dy), wrongSide, i]
        }
        var keyed = nodes.map(function (x, i) { return { x: x, k: rank(x, i) } })
        keyed.sort(function (a, b) { return a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] })
        return keyed.map(function (e) { return e.x })
    }

    Dialog.prototype.plan = function () {
        var self = this
        var pick = function (set) { return Object.keys(set).map(function (id) { return self.node(id) }) }
        return NHE.autowire.plan(asNode(this.plugin), pick(this.inputs), pick(this.outputs), this.o.connections)
    }

    Dialog.prototype.renderSummary = function () {
        var n = this.n
        n.place.disabled = !this.plugin
        if (!this.plugin) { n.summary.textContent = ''; return }
        var p = this.plan()
        var wires = function (k) { return k + (k === 1 ? ' wire' : ' wires') }
        n.summary.textContent = this.plugin.name + ': ' + (p.connect.length ? wires(p.connect.length) : 'not wired yet') +
            (p.disconnect.length ? ', in place of ' + wires(p.disconnect.length) : '')
    }

    // MOD's way of showing a port's numbers (utils/plugins.js formatValue):
    // floored to two decimals, thousands separated with commas
    var num = function (v) {
        if (v === undefined || v === null || isNaN(v)) return ''
        var parts = String(Math.floor(Number(v) * 100) / 100).split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return parts.join('.')
    }

    // The pedal's info takes over the dialog (MOD's plugin info: the same
    // fields), Back returns to it as it was. Three columns: the screenshot;
    // the details and description; the control ports. One column on a phone.
    Dialog.prototype.showInfo = function (plugin) {
        var self = this
        if (!plugin.info && typeof this.o.loadInfo === 'function') {
            this.o.loadInfo(plugin, function () { if (self.overlay && plugin.info) self.showInfo(plugin) })
            return
        }
        var info = plugin.info || {}
        this.hideInfo()
        var page = this.n.info = el('div', 'nhe-add__page', this.root)
        var bar = el('div', 'nhe-add__page-bar', page)
        var back = el('button', 'nhe-add__back', bar, icon('back') + '<span>Back</span>')
        back.type = 'button'
        back.addEventListener('click', function () { self.hideInfo() })
        var body = el('div', 'nhe-add__page-body', page)

        // 1: the screenshot, with the build badge (LOCAL, BETA, ...) as MOD shows it
        var c1 = el('div', 'nhe-add__page-col nhe-add__shot', body)
        if (info.badge) el('span', 'nhe-add__badge', c1).textContent = info.badge
        if (info.screenshot || plugin.thumb) {
            var img = el('img', null, c1)
            img.alt = ''
            img.draggable = false
            img.src = info.screenshot || plugin.thumb
        } else thumb(c1, plugin)

        // 2: name and favourite, the details, the link, the description
        var c2 = el('div', 'nhe-add__page-col', body)
        var head = el('div', 'nhe-add__page-head', c2)
        el('h2', 'nhe-add__page-name', head).textContent = plugin.name
        if (typeof this.o.onFavourite === 'function') {
            var star = el('button', 'nhe-add__star' + (plugin.favourite ? ' is-on' : ''), head, icon('star'))
            star.type = 'button'
            star.setAttribute('aria-label', 'Favourite')
            star.setAttribute('aria-pressed', plugin.favourite ? 'true' : 'false')
            star.addEventListener('click', function () {
                plugin.favourite = !plugin.favourite
                star.classList.toggle('is-on', plugin.favourite)
                star.setAttribute('aria-pressed', plugin.favourite ? 'true' : 'false')
                self.o.onFavourite(plugin, plugin.favourite)
                self.renderTabs()
            })
        }
        var dl = el('dl', 'nhe-add__facts', c2)
        var fact = function (label, value, href) {
            if (!value) return
            el('dt', null, dl).textContent = label
            var dd = el('dd', null, dl)
            if (href) {
                var a = el('a', null, dd)
                a.href = href
                a.target = '_blank'
                a.rel = 'noopener'
                a.textContent = value
            } else dd.textContent = value
        }
        var catLabel = function (c) { return (self.o.categories.filter(function (x) { return x.id === c })[0] || {}).label || c }
        fact('Brand', plugin.brand)
        fact('URI', plugin.uri)
        fact('Category', (plugin.categories || []).map(catLabel).join(', ') || 'None')
        fact('Author', info.author)
        fact('Homepage', info.homepage, info.homepage)
        fact('Installed version', info.version)
        fact('Licence', info.license ? String(info.license).replace(/^.*\/licenses\//, '').replace(/\.html$/, '') : '')
        var ports = plugin.ports || {}, rows = []
        ;[['audio', 'Audio'], ['midi', 'MIDI'], ['cv', 'CV']].forEach(function (t) {
            var p = ports[t[0]] || {}, i = (p.in || []).length, o = (p.out || []).length
            if (i || o) rows.push(t[1] + ' ' + i + ' in, ' + o + ' out')
        })
        fact('Connects', rows.join(' · '))
        if (info.onlineHref) {
            var online = el('a', 'nhe-text-button nhe-text-button--primary nhe-add__online', c2)
            online.href = info.onlineHref
            online.target = '_blank'
            online.rel = 'noopener'
            online.textContent = 'See online'
        }
        var text = String(info.comment || '').replace(/^\s+|\s+$/g, '') || 'No description available.'
        text.split(/\n\s*\n/).forEach(function (para) {
            var p = el('p', 'nhe-add__page-text', c2)
            para.split(/\n/).forEach(function (line, k) { if (k) el('br', null, p); p.appendChild(document.createTextNode(line)) })
        })

        // 3: the control ports, and CV ins / outs, as MOD lists them
        var c3 = el('div', 'nhe-add__page-col', body)
        var table = function (title, first, list) {
            if (!list || !list.length) return
            el('div', 'nhe-add__table-title', c3).textContent = title
            var t = el('table', 'nhe-add__table', c3)
            var h = el('tr', null, el('thead', null, t))
            ;[first, 'Default', 'Min', 'Max'].forEach(function (x) { el('th', null, h).textContent = x })
            var tb = el('tbody', null, t)
            list.forEach(function (q) {
                var r = el('tr', null, tb)
                ;[q.name, num(q.default), num(q.minimum), num(q.maximum)].forEach(function (x) { el('td', null, r).textContent = x })
            })
        }
        table('Control ports', 'Control', info.controls)
        table('CV inputs', 'Port', info.cvInputs)
        table('CV outputs', 'Port', info.cvOutputs)
        if (!c3.children.length) c3.parentNode.removeChild(c3)
        setTimeout(function () { back.focus() }, 0)
    }

    Dialog.prototype.hideInfo = function () {
        if (!this.n.info) return
        this.n.info.parentNode.removeChild(this.n.info)
        this.n.info = null
    }

    Dialog.prototype.place = function () {
        if (!this.plugin) return
        var r = { plugin: this.plugin, inputs: Object.keys(this.inputs), outputs: Object.keys(this.outputs), plan: this.plan() }
        this.close()
        if (typeof this.o.onPlace === 'function') this.o.onPlace(r)
    }

    Dialog.prototype.cancel = function () {
        this.close()
        if (typeof this.o.onCancel === 'function') this.o.onCancel()
    }

    Dialog.prototype.close = function () {
        if (!this.overlay) return
        this.overlay.parentNode.removeChild(this.overlay)
        this.overlay = null
    }

    NHE.AddPedalDialog = function (options) { return new Dialog(options) }
    NHE.AddPedalDialog.NEW = NEW
})();
