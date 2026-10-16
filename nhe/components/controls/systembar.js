// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE system bar: the left column with tempo, CPU / RAM meters and the chain
 * view. Spec: docs/system-bar-spec.md. Needs controls.js and controls.css.
 *
 *   var bar = new NHE.SystemBar(el, {
 *       tab: 'meters' | 'chain',
 *       tempo: 120, tempoLocked: false, sync: 'MIDI clock',
 *       cpu: 24, ram: 41, xruns: 0,
 *       plugin: 'Can Abyss Delay',
 *       chain: { inputs:  [{ port: 'In',      items: [{ id, brand, name } | { device: true }] }],
 *                outputs: [{ port: 'Out (L)', items: [...] }] },
 *       onExit, onTempo: fn(bpm), onHop: fn(id), onTab: fn(tab)
 *   })
 *   bar.setStats({ cpu, xruns })   // MOD websocket "stats"
 *   bar.setSysStats({ ram })       // MOD websocket "sys_stats"
 *   bar.setTempo(bpm, locked, sync)
 *   bar.update(options)
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon

    var XRUN_MS = 2000
    var BPM_MIN = 20, BPM_MAX = 280

    var SystemBar = function (root, options) {
        var self = this
        this.root = root
        this.o = mix({ tab: 'meters', tempo: 120, tempoLocked: false, sync: '', cpu: 0, ram: 0, xruns: 0, plugin: '', chain: { inputs: [], outputs: [] } }, options || {})
        this.timers = {}
        root.innerHTML = ''
        root.className = 'nhe-ctl nhe-system-bar'
        var n = this.n = {}

        var exit = el('button', 'nhe-system-bar__exit', root, icon('exit') + '<span>Exit</span>')
        exit.type = 'button'
        exit.addEventListener('click', function () { self.emit('onExit') })

        // meters page
        var mp = el('div', 'nhe-system-bar__page nhe-system-bar__meters-page', root)
        var hd = el('div', 'nhe-system-bar__header', mp)
        var t = el('div', 'nhe-cell__title', hd); el('span', null, t).textContent = 'Tempo'
        n.readout = el('div', 'nhe-readout', hd)
        n.readout.setAttribute('tabindex', '0')
        n.sync = el('div', 'nhe-system-bar__sync', hd)
        n.readout.addEventListener('click', function () { self.edit() })
        var meters = el('div', 'nhe-meters', mp)
        var meter = function (cls, title) {
            var m = el('div', 'nhe-meter nhe-meter--' + cls, meters)
            el('span', 'nhe-meter__title', m).textContent = title
            var v = el('span', 'nhe-meter__value', m)
            var tr = el('div', 'nhe-meter__track', m)
            var f = el('div', 'nhe-meter__fill', tr)
            return { value: v, fill: f }
        }
        n.cpu = meter('cpu', 'CPU')
        n.ram = meter('ram', 'RAM')
        n.xruns = el('div', 'nhe-system-bar__xruns', root)

        // chain page
        var cp = el('div', 'nhe-system-bar__page nhe-system-bar__chain-page', root)
        n.current = el('div', 'nhe-chain__current', cp)
        n.chain = el('div', 'nhe-chain', cp)

        // tabs
        var tabs = el('div', 'nhe-tabs', root)
        n.tabs = {}
        ;[['meters', 'meters', 'Meters'], ['chain', 'chainView', 'Chain']].forEach(function (d) {
            var b = el('button', null, tabs, icon(d[1]))
            b.type = 'button'
            b.setAttribute('aria-label', d[2])
            b.addEventListener('click', function () { self.o.tab = d[0]; self.render(); self.emit('onTab', d[0]) })
            n.tabs[d[0]] = b
        })
        this.render()
    }

    SystemBar.prototype.emit = function (name, arg) {
        var fn = this.o[name]
        if (typeof fn === 'function') fn.call(this, arg)
    }

    SystemBar.prototype.render = function () {
        var o = this.o, n = this.n
        this.root.setAttribute('data-tab', o.tab)
        n.tabs.meters.classList.toggle('is-active', o.tab === 'meters')
        n.tabs.chain.classList.toggle('is-active', o.tab === 'chain')
        if (!this.editing) n.readout.innerHTML = '<span class="nhe-readout__value">' + Number(o.tempo).toFixed(2) + '</span><span class="nhe-readout__unit">BPM</span>'
        this.root.classList.toggle('is-tempo-locked', !!o.tempoLocked)
        n.sync.textContent = (o.sync || 'Sync') + ' · Locked'
        this.meter(n.cpu, o.cpu)
        this.meter(n.ram, o.ram)
        n.xruns.textContent = o.xruns + (o.xruns === 1 ? ' xrun' : ' xruns')
        this.renderChain()
    }

    // null or NaN = the device reports no figure: show a dash and no fill
    SystemBar.prototype.meter = function (m, pct) {
        if (pct === null || pct === undefined || isNaN(pct)) { m.value.textContent = '–'; m.fill.style.setProperty('--level', 0); return }
        pct = Math.max(0, Math.min(100, Number(pct)))
        m.value.textContent = Math.round(pct) + ' %'
        m.fill.style.setProperty('--level', pct / 100)
    }

    SystemBar.prototype.renderChain = function () {
        var self = this, o = this.o, box = this.n.chain
        this.n.current.textContent = o.plugin
        box.innerHTML = ''
        var section = function (ports, ic, iconFirst) {
            ;(ports || []).forEach(function (p) {
                var head = el('div', 'nhe-chain__port', box)
                var label = '<span>' + p.port + '</span>'
                head.innerHTML = iconFirst ? icon(ic) + label : label + icon(ic)
                if (!p.items || !p.items.length) { el('div', 'nhe-chain__none', box).textContent = 'Not connected'; return }
                p.items.forEach(function (it) {
                    var c = el('button', 'nhe-card', box)
                    c.type = 'button'
                    if (it.device) {
                        el('span', 'nhe-card__brand', c).textContent = 'Device'
                        el('span', 'nhe-card__name', c).textContent = iconFirst ? 'Inputs' : 'Outputs'
                        c.disabled = true
                        return
                    }
                    el('span', 'nhe-card__brand', c).textContent = it.brand || ''
                    el('span', 'nhe-card__name', c).textContent = it.name
                    // hop: open that plugin's settings
                    c.addEventListener('click', function () { self.emit('onHop', it.id) })
                })
            })
        }
        section(o.chain.inputs, 'signIn', true)
        section(o.chain.outputs, 'signOut', false)
    }

    SystemBar.prototype.edit = function () {
        var self = this
        if (this.o.tempoLocked || this.editing) return
        this.editing = true
        var r = this.n.readout
        r.innerHTML = ''
        var input = el('input', null, r)
        input.type = 'text'
        input.setAttribute('inputmode', 'decimal')
        input.value = Number(this.o.tempo).toFixed(2)
        input.focus()
        input.select()
        var done = function (keep) {
            if (!self.editing) return
            self.editing = false
            var v = parseFloat(String(input.value).replace(',', '.'))
            if (keep && !isNaN(v)) {
                self.o.tempo = Math.max(BPM_MIN, Math.min(BPM_MAX, v))
                self.emit('onTempo', self.o.tempo)
            }
            self.render()
        }
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); done(true) }
            if (e.key === 'Escape') { e.preventDefault(); done(false) }
        })
        input.addEventListener('blur', function () { done(true) })
    }

    SystemBar.prototype.setStats = function (s) {
        var self = this
        if (s.xruns !== undefined && s.xruns !== null && this.o.xruns !== null && s.xruns > this.o.xruns) {
            this.root.classList.add('is-xrun')
            clearTimeout(this.timers.xrun)
            this.timers.xrun = setTimeout(function () { self.root.classList.remove('is-xrun') }, XRUN_MS)
        }
        if (s.cpu !== undefined) this.o.cpu = s.cpu
        if (s.xruns !== undefined) this.o.xruns = s.xruns
        this.render()
    }

    SystemBar.prototype.setSysStats = function (s) { if (s.ram !== undefined) this.o.ram = s.ram; this.render() }
    SystemBar.prototype.setTempo = function (bpm, locked, sync) { this.o.tempo = bpm; this.o.tempoLocked = !!locked; if (sync !== undefined) this.o.sync = sync; this.render() }
    SystemBar.prototype.update = function (options) { this.o = mix(this.o, options || {}); this.render() }

    NHE.SystemBar = SystemBar
})();
