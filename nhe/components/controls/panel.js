// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE panel layout: lays out a plugin's controls in columns, stacking buttons
 * and option lists (docs/button-spec.md, "Stacking"):
 *
 *   1. Walk the controls in MOD's port order and split them into segments: a
 *      stretch in the same port group, or a stretch of ungrouped controls.
 *   2. In each segment, gather the stackable controls (toggles, triggers,
 *      option lists) into one stack where the first of them was. Sliders keep
 *      their order.
 *   3. A stack fills a column top to bottom with cells of their own height;
 *      when the next one doesn't fit, it wraps to a new column.
 *   4. A group change always starts a new column; each column gets the group
 *      band (Start / Middle / End / Single), the name sized to the group.
 *
 *   var panel = new NHE.Panel(el, {
 *       height: 646,                                // the slider height
 *       plugin: { name, on, binding, presets: { factory, user, selected } },   // optional left column
 *       controls: [{ id, type: 'slider'|'toggle'|'trigger'|'list',
 *                    group: null | { id, name, color },
 *                    options: { ...the component's options } }],
 *       onChange: fn(id, value), onSettings: fn(id), onBlocked: fn(id), onTrigger: fn(id), onPreset: fn(action, preset)
 *   })
 *   panel.control(id)   // the component instance, e.g. to setValue from MOD
 *   NHE.Panel.columns(controls, height)   // the layout alone, for tests
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var el = NHE.controlHelpers.el, mix = NHE.controlHelpers.mix

    var BAND = 44
    var CELL = 169           // toggle / trigger cell
    var LIST_ROW = 44, LIST_VISIBLE = 3.5
    var STACKABLE = { toggle: true, trigger: true, list: true }

    var cellHeight = function (c) {
        if (c.type !== 'list') return CELL
        var n = ((c.options && c.options.options) || []).length
        return 1 + 33 + Math.min(n, LIST_VISIBLE) * LIST_ROW + 2 + 48
    }

    var widthOf = function (col) {
        return col.kind === 'slider' && col.control.options && col.control.options.minimised ? 60 : 120
    }

    // the layout alone: [{ kind: 'slider'|'stack', control | cells, group, groupKind, groupWidth }]
    var columns = function (controls, height) {
        var room = (height || 646) - BAND
        var segments = [], seg = null
        controls.forEach(function (c) {
            var key = c.group ? c.group.id : null
            if (!seg || seg.key !== key) { seg = { key: key, group: c.group || null, items: [] }; segments.push(seg) }
            seg.items.push(c)
        })
        var out = []
        segments.forEach(function (s) {
            // gather the stackables where the first of them was
            var seq = [], stack = null
            s.items.forEach(function (c) {
                if (STACKABLE[c.type]) {
                    if (!stack) { stack = []; seq.push({ stack: stack }) }
                    stack.push(c)
                } else seq.push({ control: c })
            })
            var cols = []
            seq.forEach(function (it) {
                if (it.control) { cols.push({ kind: 'slider', control: it.control }); return }
                var col = null, used = 0
                it.stack.forEach(function (c) {
                    var h = cellHeight(c)
                    if (!col || (used + h > room && col.cells.length)) { col = { kind: 'stack', cells: [] }; cols.push(col); used = 0 }
                    col.cells.push(c)
                    used += h
                })
            })
            var total = 0
            cols.forEach(function (c) { total += widthOf(c) })
            cols.forEach(function (c, i) {
                c.group = s.group
                c.groupKind = !s.group ? 'none' : cols.length === 1 ? 'single' : i === 0 ? 'start' : i === cols.length - 1 ? 'end' : 'middle'
                c.groupWidth = total
                out.push(c)
            })
        })
        return out
    }

    var Panel = function (root, options) {
        this.root = root
        this.o = mix({ height: 646, controls: [], plugin: null }, options || {})
        this.instances = {}
        this.render()
    }

    Panel.columns = columns

    Panel.prototype.emit = function (name, a, b) {
        var fn = this.o[name]
        if (typeof fn === 'function') fn.call(this, a, b)
    }

    Panel.prototype.control = function (id) { return this.instances[id] }

    Panel.prototype.render = function () {
        var self = this, o = this.o, root = this.root
        root.innerHTML = ''
        root.className = 'nhe-ctl nhe-panel'
        root.style.setProperty('--nhe-slider-height', o.height + 'px')
        this.instances = {}

        var cb = function (id) {
            return {
                onChange: function (v) { self.emit('onChange', id, v) },
                onInput: function (v) { self.emit('onInput', id, v) },
                onSettings: function () { self.emit('onSettings', id) },
                onBlocked: function () { self.emit('onBlocked', id) },
                onTrigger: function () { self.emit('onTrigger', id) }
            }
        }

        if (o.plugin) {
            var pc = el('div', 'nhe-panel__plugin', root)
            pc.style.height = o.height + 'px'
            this.header = new NHE.PluginHeader(el('div', null, pc), mix({ name: o.plugin.name, on: o.plugin.on !== false, binding: o.plugin.binding || null }, mix(cb(':bypass'), {})))
            var pd = el('div', null, pc)
            pd.style.flex = '1 1 auto'
            pd.style.minHeight = '0'
            var pr = o.plugin.presets || {}
            var act = function (a) { return function (p) { self.emit('onPreset', a, p) } }
            this.presets = new NHE.PresetList(pd, mix(pr, { binding: pr.binding || null, onLoad: act('load'), onSaveAs: act('saveAs'), onSave: act('save'), onRename: act('rename'), onDelete: act('delete'), onSettings: function () { self.emit('onSettings', ':presets') }, onBlocked: function () { self.emit('onBlocked', ':presets') } }))
            pd.style.display = 'flex'
            pd.style.height = '100%'
        }

        columns(o.controls, o.height).forEach(function (col) {
            var color = col.group ? (col.group.color || 0) : 0
            if (col.kind === 'slider') {
                var c = col.control
                var d = el('div', null, root)
                var group = { kind: col.groupKind, name: col.group ? col.group.name : '', color: color, width: col.groupWidth }
                self.instances[c.id] = new NHE.Slider(d, mix(mix(c.options, { group: group }), cb(c.id)))
                return
            }
            var st = el('div', 'nhe-stack', root)
            st.setAttribute('data-group', col.groupKind)
            st.style.setProperty('--nhe-slider-group-color', 'var(--nhe-group-' + color + ')')
            st.style.setProperty('--nhe-slider-group-width', col.groupWidth + 'px')
            var band = el('div', 'nhe-stack__band', st)
            el('div', 'nhe-stack__bar', band)
            el('div', 'nhe-stack__name', band).textContent = col.group ? col.group.name : ''
            col.cells.forEach(function (c, i) {
                var d = el('div', null, st)
                var Ctor = c.type === 'toggle' ? NHE.Toggle : c.type === 'trigger' ? NHE.Trigger : NHE.OptionList
                self.instances[c.id] = new Ctor(d, mix(c.options, cb(c.id)))
                if (i === 0) d.classList.add('is-first')
            })
        })
    }

    Panel.prototype.update = function (options) { this.o = mix(this.o, options || {}); this.render() }

    NHE.Panel = Panel
})();
