// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE addressing dialog: what a control is assigned to (device, MIDI,
 * Control Chain, CV), its label, range and the settings that go with the
 * assignment. Spec: docs/addressing-spec.md. Needs controls.js and .css.
 *
 * The dialog only draws. A model says what to show and takes the changes,
 * so the same dialog runs on MOD (the adapter's model drives MOD's own form)
 * and in the playground (a fake model).
 *
 *   var dlg = NHE.AddressingDialog({
 *       plugin: 'Can Abyss Delay', control: 'Tap',
 *       model: {
 *           state: fn() -> {
 *               types: [{ id, label }], type,
 *               targets: [{ id, label, disabled, selected }] | null,   // the right-hand list
 *               message: '',                  // shown instead of the list (MIDI, nothing available)
 *               label, min, max, range: bool, // range: show Min / Max
 *               settings: [{ id, title, options: [{ label, value }], value, disabled }],
 *               tempo: null | { on, dividers: [{ label, value }], divider },
 *               canSave: bool
 *           },
 *           setType(id), setTarget(id), setSetting(id, value), setTempo(on), setDivider(value),
 *           save({ label, min, max }) -> error message or nothing,
 *           cancel()
 *       },
 *       minimised: null | bool,     // null: not a slider, no Minimise item
 *       surface: null | bool,       // on the live surface; null: no Add to surface item
 *       accent: null | '#rrggbb',   // the plugin's colour (colour.js)
 *       onMinimise: fn(bool),       // on Save, when it changed
 *       onSurface: fn(bool),        // on Save, when it changed
 *       onClose: fn(saved)
 *   })
 *   dlg.close()
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon

    // tapping a field to type empties it, so what's typed is the whole value;
    // the old value shows as the placeholder and comes back if left empty
    var clearOnFocus = function (input) {
        input.addEventListener('focus', function () {
            input.placeholder = input.value
            input.value = ''
        })
        input.addEventListener('blur', function () {
            if (input.value === '') input.value = input.placeholder
        })
    }

    var Dialog = function (options) {
        var self = this
        this.o = mix({ plugin: '', control: '', model: null, minimised: null, surface: null }, options || {})
        this.minimised = this.o.minimised
        this.surface = this.o.surface
        var m = this.o.model, st = m.state()

        var overlay = this.overlay = el('div', 'nhe-ctl nhe-dialog-overlay', document.body)
        var d = this.root = el('div', 'nhe-dialog', overlay)
        if (this.o.accent && NHE.accent) NHE.accent.apply(overlay, this.o.accent)   // the plugin's colour
        d.setAttribute('role', 'dialog')
        d.setAttribute('aria-modal', 'true')
        d.setAttribute('aria-label', this.o.control + ' settings')

        var head = el('div', 'nhe-dialog__header', d)
        el('span', 'nhe-dialog__plugin', head).textContent = this.o.plugin
        el('span', 'nhe-dialog__pill', head).textContent = this.o.control

        var n = this.n = {}
        el('div', 'nhe-dialog__title', d, icon('assign') + '<span>Assign to</span>')
        var assign = el('div', 'nhe-dialog__assign', d)
        n.types = el('div', 'nhe-list', assign)
        n.types.setAttribute('role', 'listbox')
        n.right = el('div', 'nhe-dialog__right', assign)

        n.tempo = el('div', 'nhe-dialog__tempo', d)
        // the settings that go with the assignment sit right under it; label
        // and range (the control's own) come after
        n.settings = el('div', 'nhe-dialog__settings', d)

        n.labelBox = el('div', 'nhe-dialog__field', d)
        el('div', 'nhe-dialog__title', n.labelBox, icon('tag') + '<span>Control label</span>')
        n.label = el('input', 'nhe-dialog__input', n.labelBox)
        n.label.type = 'text'
        n.label.value = st.label || ''
        clearOnFocus(n.label)

        n.range = el('div', 'nhe-dialog__pair', d)
        var field = function (title) {
            var f = el('div', 'nhe-dialog__field', n.range)
            el('div', 'nhe-dialog__title', f, icon('range') + '<span>' + title + '</span>')
            var i = el('input', 'nhe-dialog__input', f)
            i.type = 'text'
            i.setAttribute('inputmode', 'decimal')
            return i
        }
        n.min = field('Min')
        n.max = field('Max')
        n.min.value = st.min === undefined || st.min === null ? '' : st.min
        n.max.value = st.max === undefined || st.max === null ? '' : st.max
        clearOnFocus(n.min)
        clearOnFocus(n.max)

        n.extras = el('div', 'nhe-dialog__pair nhe-dialog__extras', d)
        n.minimise = el('button', 'nhe-dialog__extra', n.extras)
        n.minimise.type = 'button'
        n.minimise.addEventListener('click', function () { self.minimised = !self.minimised; self.renderExtras() })
        n.surface = el('button', 'nhe-dialog__extra', n.extras)
        n.surface.type = 'button'
        n.surface.addEventListener('click', function () { self.surface = !self.surface; self.renderExtras() })

        n.error = el('div', 'nhe-dialog__error', d)

        var foot = el('div', 'nhe-dialog__buttons', d)
        foot.appendChild(NHE.textButton('Cancel', 'secondary', function () { self.cancel() }))
        n.save = NHE.textButton('Save', 'primary', function () { self.save() })
        foot.appendChild(n.save)

        d.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); self.cancel() }
            else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); self.save() }
        })
        // MOD listens for keys on the page (Escape closes its windows): keep ours in here
        d.addEventListener('keyup', function (e) { e.stopPropagation() })

        NHE.dragScroll(d)
        this.render()
        this.renderExtras()
        setTimeout(function () { d.focus() }, 0)
        d.setAttribute('tabindex', '-1')
    }

    Dialog.prototype.render = function () {
        var self = this, m = this.o.model, n = this.n, st = m.state()
        this.st = st

        var row = function (list, label, selected, disabled, onPick, wide) {
            var r = el('button', 'nhe-row' + (wide ? ' nhe-row--wide' : '') + (selected ? ' is-selected' : ''), list)
            r.type = 'button'
            r.setAttribute('role', 'option')
            r.setAttribute('aria-selected', selected ? 'true' : 'false')
            if (disabled) { r.disabled = true; r.classList.add('is-disabled') }
            el('span', 'nhe-row__label', r).textContent = label
            r.addEventListener('click', function () { onPick(); self.render() })
            return r
        }
        var keep = n.types.scrollTop
        n.types.innerHTML = ''
        st.types.forEach(function (t) { row(n.types, t.label, t.id === st.type, false, function () { m.setType(t.id) }) })
        n.types.scrollTop = keep

        // the right side: the targets, or a message
        var right = n.right, keepR = right.firstChild && right.firstChild.scrollTop
        right.innerHTML = ''
        if (st.targets && st.targets.length) {
            var list = el('div', 'nhe-list', right)
            list.setAttribute('role', 'listbox')
            st.targets.forEach(function (t) { row(list, t.label, t.selected, t.disabled, function () { m.setTarget(t.id) }, true) })
            list.scrollTop = keepR || 0
        } else {
            var msg = el('div', 'nhe-dialog__message', right)
            msg.textContent = st.message || ''
        }

        // tempo: follow the pedalboard tempo, with a note value
        n.tempo.innerHTML = ''
        n.tempo.style.display = st.tempo ? '' : 'none'
        if (st.tempo) {
            var tr = el('div', 'nhe-dialog__setting', n.tempo)
            el('div', 'nhe-dialog__setting-title', tr).textContent = 'Follow tempo'
            new NHE.Segmented(el('div', null, tr), { options: ['Off', 'On'], value: st.tempo.on ? 1 : 0, onChange: function (i) { m.setTempo(!!i); self.render() } })
            if (st.tempo.on && st.tempo.dividers.length) {
                var dl = el('div', 'nhe-list nhe-dialog__dividers', n.tempo)
                st.tempo.dividers.forEach(function (dv) {
                    row(dl, dv.label, String(dv.value) === String(st.tempo.divider), false, function () { m.setDivider(dv.value) })
                })
                var sel = dl.querySelector('.is-selected')
                if (sel) dl.scrollTop = Math.max(0, sel.offsetTop - 44)
            }
        }

        n.range.style.display = st.range ? '' : 'none'
        var rangeOff = !!(st.tempo && st.tempo.on)
        n.min.disabled = n.max.disabled = rangeOff

        n.settings.innerHTML = ''
        ;(st.settings || []).forEach(function (s) {
            var r = el('div', 'nhe-dialog__setting', n.settings)
            el('div', 'nhe-dialog__setting-title', r).textContent = s.title
            var idx = 0
            s.options.forEach(function (op, i) { if (String(op.value) === String(s.value)) idx = i })
            var seg = el('div', null, r)
            new NHE.Segmented(seg, { options: s.options.map(function (op) { return op.label }), value: idx, onChange: function (i) { m.setSetting(s.id, s.options[i].value); self.render() } })
            if (s.disabled) r.classList.add('is-disabled')
        })
        this.renderSave()
    }

    Dialog.prototype.renderExtras = function () {
        var n = this.n
        n.minimise.style.display = this.minimised === null ? 'none' : ''
        n.minimise.innerHTML = this.minimised ? icon('expand') + '<span>Expand control</span>' : icon('minimise') + '<span>Minimise control</span>'
        // the live surface (features/live)
        n.surface.style.display = this.surface === null ? 'none' : ''
        n.surface.innerHTML = icon('star') + '<span>' + (this.surface ? 'Remove from surface' : 'Add to surface') + '</span>'
        n.surface.classList.toggle('is-on', !!this.surface)
        n.extras.style.display = this.minimised === null && this.surface === null ? 'none' : ''
        this.renderSave()
    }

    // Save works when the model can save, or when only the minimised or surface state changed
    Dialog.prototype.renderSave = function () {
        if (!this.st) return
        this.n.save.disabled = !(this.st.canSave || this.minimised !== this.o.minimised || this.surface !== this.o.surface)
    }

    Dialog.prototype.save = function () {
        var n = this.n, st = this.st
        if (n.save.disabled) return
        n.error.textContent = ''
        var mini = this.minimised !== this.o.minimised
        if (st.canSave) {
            var val = function (i) { return i.value === '' ? i.placeholder : i.value }   // a field still empty keeps its old value
            var values = { label: val(n.label) }
            if (st.range && !n.min.disabled) {
                var lo = parseFloat(String(val(n.min)).replace(',', '.')), hi = parseFloat(String(val(n.max)).replace(',', '.'))
                if (isNaN(lo) || isNaN(hi)) { n.error.textContent = 'Min and Max need a number.'; return }
                if (lo >= hi) { n.error.textContent = 'Min has to be lower than Max.'; return }
                values.min = lo
                values.max = hi
            }
            var err = this.o.model.save(values)
            if (err) { n.error.textContent = err; return }
        } else {
            this.o.model.cancel()
        }
        if (mini && typeof this.o.onMinimise === 'function') this.o.onMinimise(this.minimised)
        if (this.surface !== this.o.surface && typeof this.o.onSurface === 'function') this.o.onSurface(this.surface)
        this.close(true)
    }

    Dialog.prototype.cancel = function () {
        this.o.model.cancel()
        this.close(false)
    }

    Dialog.prototype.close = function (saved) {
        if (!this.overlay) return
        this.overlay.parentNode.removeChild(this.overlay)
        this.overlay = null
        if (typeof this.o.onClose === 'function') this.o.onClose(!!saved)
    }

    NHE.AddressingDialog = function (options) { return new Dialog(options) }
})();
