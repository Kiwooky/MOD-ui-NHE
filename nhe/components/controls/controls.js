// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE controls besides the slider. Specs: docs/button-spec.md and
 * docs/select-spec.md. Needs theme/tokens.css, components/icons.js and
 * components/controls/controls.css.
 *
 *   new NHE.Toggle(el, { title, value: true|false, binding, onChange, onSettings, onBlocked })
 *   new NHE.Trigger(el, { title, binding, onTrigger, onSettings, onBlocked })
 *   new NHE.PluginHeader(el, { name, on: true|false, binding, onChange, onSettings, onBlocked })
 *   new NHE.OptionList(el, { title, options: [{ label, value }], value, binding, onChange, onSettings, onBlocked })
 *   new NHE.Segmented(el, { options: ['Factory', 'User'], value: 0, onChange })
 *   new NHE.PresetList(el, { factory: [{ id, name }], user: [{ id, name }], selected: id, binding,
 *                            onLoad, onSaveAs, onSave, onRename, onDelete, onSettings, onBlocked })
 *   NHE.iconButton(name, { label, disabled, onClick }) -> <button>
 *   NHE.textButton(label, 'primary'|'secondary', onClick) -> <button>
 *
 * Every control has update(options). `binding` is null or
 * { type: 'midi'|'cv'|'device'|'chain', kind, label, locked }: shared bindings
 * show the icon next to the settings icon; locked ones grey the control, put
 * the icon on its face and refuse a touch (orange ring + overlay). Plain ES5.
 */
(function () {
    var NHE = window.NHE = window.NHE || {}

    var BLOCKED_MS = 600
    var INFO_MS = 2000
    var PRESSED_MS = 150     // a trigger shows Pressed at least this long

    var el = function (tag, cls, parent, html) {
        var e = document.createElement(tag)
        if (cls) e.className = cls
        if (html !== undefined) e.innerHTML = html
        if (parent) parent.appendChild(e)
        return e
    }
    var mix = function (a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k]; return o }
    var icon = function (name) { return (NHE.icons && NHE.icons[name]) || '' }

    NHE.iconButton = function (name, o) {
        o = o || {}
        var b = el('button', 'nhe-icon-button', null, icon(name))
        b.type = 'button'
        if (o.label) b.setAttribute('aria-label', o.label)
        if (o.disabled) b.disabled = true
        if (o.onClick) b.addEventListener('click', o.onClick)
        return b
    }

    NHE.textButton = function (label, variant, onClick) {
        var b = el('button', 'nhe-text-button nhe-text-button--' + (variant || 'primary'))
        b.type = 'button'
        b.textContent = label
        if (onClick) b.addEventListener('click', onClick)
        return b
    }

    // ---- shared: footer, binding states, overlay ----------------------------

    var Base = function () {}

    Base.prototype.init = function (root, cls, options, defaults) {
        this.root = root
        this.o = mix(defaults, options || {})
        this.timers = {}
        root.innerHTML = ''
        root.className = 'nhe-ctl ' + cls
    }

    Base.prototype.emit = function (name, arg) {
        var fn = this.o[name]
        if (typeof fn === 'function') fn.call(this, arg)
    }

    Base.prototype.state = function (name, on) { this.root.classList.toggle('is-' + name, !!on) }
    Base.prototype.has = function (name) { return this.root.classList.contains('is-' + name) }
    Base.prototype.locked = function () { return !!(this.o.binding && this.o.binding.locked) }

    // settings icon + binding icon (the binding icon shows only when shared)
    Base.prototype.footer = function (parent) {
        var self = this
        var f = el('div', 'nhe-footer', parent)
        this.n.settings = NHE.iconButton('settings', { label: 'Settings', onClick: function () { self.emit('onSettings') } })
        f.appendChild(this.n.settings)
        this.n.binding = NHE.iconButton('midi', { onClick: function () { self.info(!self.has('info')) } })
        this.n.binding.classList.add('nhe-binding-button')
        f.appendChild(this.n.binding)
        return f
    }

    Base.prototype.overlay = function () {
        var self = this
        var ov = el('div', 'nhe-overlay', this.root)
        this.n.ovKind = el('span', 'nhe-overlay__kind', ov)
        this.n.ovLabel = el('span', 'nhe-overlay__label', ov)
        this.n.ovStatus = el('span', 'nhe-overlay__status', ov)
        ov.addEventListener('click', function () { self.info(false) })
    }

    Base.prototype.faceIcon = function (parent) {
        this.n.face = el('span', 'nhe-face-icon', parent)
    }

    Base.prototype.renderBinding = function () {
        var b = this.o.binding
        this.state('bound', !!b)
        this.state('locked', !!(b && b.locked))
        if (!b) { this.info(false); this.state('blocked', false); return }
        var svg = icon(b.type) || icon('midi')
        if (this.n.binding) { this.n.binding.innerHTML = svg; this.n.binding.setAttribute('aria-label', 'Bound to ' + (b.kind || '') + ' ' + (b.label || '')) }
        if (this.n.face) this.n.face.innerHTML = svg
        if (this.n.rowIcon) this.n.rowIcon.innerHTML = svg
        if (this.n.ovKind) {
            this.n.ovKind.textContent = b.kind || ''
            this.n.ovLabel.textContent = b.label || ''
            this.n.ovStatus.textContent = b.locked ? 'Locked' : 'Shared'
        }
    }

    Base.prototype.info = function (on) {
        var self = this
        clearTimeout(this.timers.info)
        this.state('info', on && !!this.o.binding)
        if (on) this.timers.info = setTimeout(function () { self.state('info', false) }, INFO_MS)
    }

    // a refused touch on a locked control: the orange ring and the overlay
    Base.prototype.blocked = function () {
        var self = this
        this.info(true)
        this.state('blocked', true)
        clearTimeout(this.timers.blocked)
        this.timers.blocked = setTimeout(function () { self.state('blocked', false) }, BLOCKED_MS)
        this.emit('onBlocked')
    }

    Base.prototype.update = function (options) {
        this.o = mix(this.o, options || {})
        this.render()
    }

    var extend = function (Ctor) { Ctor.prototype = new Base(); Ctor.prototype.constructor = Ctor; return Ctor }

    // ---- Toggle ----------------------------------------------------------

    var Toggle = extend(function (root, options) {
        var self = this
        this.init(root, 'nhe-cell nhe-toggle', options, { title: '', value: false, binding: null })
        var n = this.n = {}
        n.title = el('span', null, el('div', 'nhe-cell__title', root))
        n.sw = el('button', 'nhe-toggle__switch', root)
        n.sw.type = 'button'
        n.sw.setAttribute('role', 'switch')
        n.band = el('span', 'nhe-toggle__band', n.sw)
        n.pad = el('span', 'nhe-toggle__pad', n.sw)
        this.faceIcon(n.pad)
        this.footer(root)
        this.overlay()
        var release = function () { self.state('pressed', false) }
        n.sw.addEventListener('pointerdown', function () { if (!self.locked()) self.state('pressed', true) })
        n.sw.addEventListener('pointerup', release)
        n.sw.addEventListener('pointerleave', release)
        n.sw.addEventListener('pointercancel', release)
        n.sw.addEventListener('click', function () {
            if (self.locked()) { self.blocked(); return }
            self.o.value = !self.o.value
            self.render()
            self.emit('onChange', self.o.value)
        })
        this.render()
    })

    Toggle.prototype.render = function () {
        var o = this.o
        this.n.title.textContent = o.title
        this.n.band.textContent = o.value ? 'ON' : 'OFF'
        this.n.sw.setAttribute('aria-checked', o.value ? 'true' : 'false')
        this.n.sw.setAttribute('aria-label', o.title)
        this.state('on', o.value)
        this.renderBinding()
    }

    Toggle.prototype.setValue = function (v) { this.o.value = !!v; this.render() }

    // ---- Trigger ---------------------------------------------------------

    var Trigger = extend(function (root, options) {
        var self = this
        this.init(root, 'nhe-cell nhe-trigger', options, { title: '', binding: null })
        var n = this.n = {}
        n.title = el('span', null, el('div', 'nhe-cell__title', root))
        n.btn = el('button', 'nhe-trigger__button', root)
        n.btn.type = 'button'
        el('span', 'nhe-trigger__inner', n.btn)
        this.faceIcon(n.btn)
        this.footer(root)
        this.overlay()
        var down = 0
        n.btn.addEventListener('pointerdown', function (e) {
            e.preventDefault()
            if (self.locked()) { self.blocked(); return }
            down = Date.now()
            self.state('pressed', true)
            self.emit('onTrigger')       // MOD: press sends the maximum; the plugin resets it
        })
        var up = function () {
            if (!down) return
            var left = PRESSED_MS - (Date.now() - down)
            down = 0
            clearTimeout(self.timers.pressed)
            self.timers.pressed = setTimeout(function () { self.state('pressed', false) }, Math.max(0, left))
        }
        n.btn.addEventListener('pointerup', up)
        n.btn.addEventListener('pointercancel', up)
        n.btn.addEventListener('pointerleave', up)
        n.btn.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            if (self.locked()) { self.blocked(); return }
            down = Date.now(); self.state('pressed', true); self.emit('onTrigger'); up()
        })
        this.render()
    })

    Trigger.prototype.render = function () {
        this.n.title.textContent = this.o.title
        this.n.btn.setAttribute('aria-label', this.o.title)
        this.renderBinding()
    }

    // ---- Plugin header (name bar + on/off switch) ---------------------------

    var PluginHeader = extend(function (root, options) {
        var self = this
        this.init(root, 'nhe-plugin-header', options, { name: '', on: true, binding: null })
        var n = this.n = {}
        n.name = el('div', 'nhe-plugin-header__name', root)
        var row = el('div', 'nhe-plugin-header__row', root)
        n.sw = el('button', 'nhe-plugin-header__switch', row)
        n.sw.type = 'button'
        n.sw.setAttribute('role', 'switch')
        n.pad = el('span', 'nhe-plugin-header__pad', n.sw)
        this.faceIcon(n.pad)
        n.label = el('span', 'nhe-plugin-header__label', n.sw)
        this.footer(row)
        this.overlay()
        n.sw.addEventListener('click', function () {
            if (self.locked()) { self.blocked(); return }
            self.o.on = !self.o.on
            self.render()
            self.emit('onChange', self.o.on)   // MOD's :bypass is the inverse: value 1 = bypassed
        })
        this.render()
    })

    PluginHeader.prototype.render = function () {
        this.n.name.textContent = this.o.name
        this.n.label.textContent = this.o.on ? 'ON' : 'OFF'
        this.n.sw.setAttribute('aria-checked', this.o.on ? 'true' : 'false')
        this.n.sw.setAttribute('aria-label', 'Plugin on')
        this.state('on', this.o.on)
        this.renderBinding()
    }

    // ---- Option list (enumerated port) ---------------------------------------

    var ROW = 44, VISIBLE = 3.5

    var OptionList = extend(function (root, options) {
        this.init(root, 'nhe-cell nhe-option-list', options, { title: '', options: [], value: null, binding: null })
        var n = this.n = {}
        n.title = el('span', null, el('div', 'nhe-cell__title', root))
        n.list = el('div', 'nhe-list', root)
        n.list.setAttribute('role', 'listbox')
        n.list.setAttribute('tabindex', '0')
        this.footer(root)
        this.overlay()
        var self = this
        n.list.addEventListener('keydown', function (e) {
            var d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
            if (!d) return
            e.preventDefault()
            if (self.locked()) { self.blocked(); return }
            var i = self.index() + d
            if (i >= 0 && i < self.o.options.length) self.pick(i)
        })
        this.render()
    })

    OptionList.prototype.index = function () {
        var o = this.o, best = 0, bestDiff = Infinity
        for (var i = 0; i < o.options.length; i++) {
            var d = Math.abs(Number(o.options[i].value) - Number(o.value))
            if (d < bestDiff) { bestDiff = d; best = i }      // MOD: the nearest scale point
        }
        return best
    }

    OptionList.prototype.pick = function (i) {
        var v = this.o.options[i].value
        this.setValue(v)
        this.emit('onChange', v)
    }

    OptionList.prototype.render = function () {
        var self = this, o = this.o, list = this.n.list
        this.n.title.textContent = o.title
        list.innerHTML = ''
        var sel = this.index()
        this.n.rowIcon = null
        o.options.forEach(function (opt, i) {
            var r = el('button', 'nhe-row' + (i === sel ? ' is-selected' : ''), list)
            r.type = 'button'
            r.setAttribute('role', 'option')
            r.setAttribute('aria-selected', i === sel ? 'true' : 'false')
            el('span', 'nhe-row__label', r).textContent = opt.label
            var ic = el('span', 'nhe-row__icon', r)
            if (i === sel) self.n.rowIcon = ic
            r.addEventListener('click', function () {
                if (self.locked()) { self.blocked(); return }
                self.pick(i)
            })
        })
        // 3½ rows show, so a partly visible last row says there is more
        list.style.height = Math.min(o.options.length, VISIBLE) * ROW + 2 + 'px'
        this.renderBinding()
        var selRow = list.children[sel]
        if (selRow) list.scrollTop = Math.max(0, selRow.offsetTop - ROW)
    }

    // an outside value only moves the highlight: rebuilding the rows here
    // would lose a click that is half-way (pressed, not yet released)
    OptionList.prototype.setValue = function (v) {
        if (v === this.o.value) return
        this.o.value = v
        var sel = this.index(), rows = this.n.list.children, self = this
        for (var i = 0; i < rows.length; i++) {
            var on = i === sel
            rows[i].classList.toggle('is-selected', on)
            rows[i].setAttribute('aria-selected', on ? 'true' : 'false')
            if (on) { self.n.rowIcon = rows[i].querySelector('.nhe-row__icon') }
        }
        this.renderBinding()
    }

    // ---- Segmented switch -------------------------------------------------

    var Segmented = function (root, options) {
        this.root = root
        this.o = mix({ options: [], value: 0 }, options || {})
        root.className = 'nhe-ctl nhe-segmented'
        this.render()
    }

    Segmented.prototype.render = function () {
        var self = this
        this.root.innerHTML = ''
        this.o.options.forEach(function (label, i) {
            var b = el('button', i === self.o.value ? 'is-active' : '', self.root)
            b.type = 'button'
            b.textContent = label
            b.addEventListener('click', function () {
                if (self.o.value === i) return
                self.o.value = i
                self.render()
                if (typeof self.o.onChange === 'function') self.o.onChange(i)
            })
        })
    }

    Segmented.prototype.update = function (options) { this.o = mix(this.o, options); this.render() }

    // ---- Preset list -------------------------------------------------------

    var PresetList = extend(function (root, options) {
        var self = this
        this.init(root, 'nhe-presets', options, { factory: [], user: [], selected: null, binding: null, tab: null })
        var n = this.n = {}
        n.title = el('span', null, el('div', 'nhe-cell__title', root))
        n.title.textContent = 'Presets'
        n.seg = el('div', null, root)
        this.segmented = new Segmented(n.seg, { options: ['Factory', 'User'], onChange: function (i) { self.o.tab = i ? 'user' : 'factory'; self.render() } })
        n.list = el('div', 'nhe-list', root)
        n.list.setAttribute('role', 'listbox')
        var acts = el('div', 'nhe-presets__actions', root)
        var act = function (name, label, cb) {
            var b = NHE.iconButton(name, { label: label, onClick: function () { if (self.locked() && cb !== 'onSaveAs') { self.blocked(); return } self.emit(cb, self.current()) } })
            acts.appendChild(b)
            return b
        }
        n.saveAs = act('saveAs', 'Save as', 'onSaveAs')
        n.save = act('save', 'Save', 'onSave')
        n.rename = act('rename', 'Rename', 'onRename')
        n.remove = act('remove', 'Delete', 'onDelete')
        this.footer(root)
        this.overlay()
        this.render()
    })

    PresetList.prototype.current = function () {
        var all = this.o.factory.concat(this.o.user)
        for (var i = 0; i < all.length; i++) if (all[i].id === this.o.selected) return all[i]
        return null
    }

    PresetList.prototype.isUser = function (id) {
        for (var i = 0; i < this.o.user.length; i++) if (this.o.user[i].id === id) return true
        return false
    }

    PresetList.prototype.render = function () {
        var self = this, o = this.o
        var noFactory = !o.factory.length
        this.state('no-factory', noFactory)
        // no presets at all: the action row alone, so a first preset can be saved
        this.state('empty', !o.factory.length && !o.user.length)
        // the list showing: the user's choice, else the one holding the selected preset
        var tab = noFactory ? 'user' : (o.tab || (this.isUser(o.selected) ? 'user' : 'factory'))
        this.segmented.update({ value: tab === 'user' ? 1 : 0 })
        var items = tab === 'user' ? o.user : o.factory
        var list = this.n.list
        list.innerHTML = ''
        this.n.rowIcon = null
        items.forEach(function (p) {
            var sel = p.id === o.selected
            var r = el('button', 'nhe-row nhe-row--wide' + (sel ? ' is-selected' : ''), list)
            r.type = 'button'
            r.setAttribute('role', 'option')
            el('span', 'nhe-row__label', r).textContent = p.name
            var ic = el('span', 'nhe-row__icon', r)
            if (sel) self.n.rowIcon = ic
            r.addEventListener('click', function () {
                if (self.locked()) { self.blocked(); return }
                o.selected = p.id
                self.render()
                self.emit('onLoad', p)
            })
        })
        // MOD's rules: Save as always; Save / Rename / Delete only for a user preset, not while locked
        var userSel = this.isUser(o.selected) && !this.locked()
        this.n.save.disabled = !userSel
        this.n.rename.disabled = !userSel
        this.n.remove.disabled = !userSel
        this.renderBinding()
    }

    // ---- File list (LV2 path parameters: NAM models, IRs…) --------------------

    var FileList = function (root, options) {
        var self = this
        this.root = root
        this.o = mix({ title: '', items: [], t3k: false }, options || {})
        root.innerHTML = ''
        root.className = 'nhe-ctl nhe-file-list'
        el('div', 'nhe-file-list__band', root)
        var t = el('div', 'nhe-cell__title', root)
        this.title = el('span', null, t)
        this.list = el('div', 'nhe-list', root)
        this.list.setAttribute('role', 'listbox')
        var f = el('div', 'nhe-footer', root)
        this.t3k = NHE.textButton('T3K', 'secondary', function () { if (typeof self.o.onT3K === 'function') self.o.onT3K() })
        this.t3k.classList.add('nhe-file-list__t3k')
        this.t3k.title = 'Browse tones on Tone3000'
        f.appendChild(this.t3k)
        this.render()
    }

    var FILE_ICON = { up: 'folderUp', folder: 'folder', file: 'file' }

    FileList.prototype.render = function () {
        var self = this, o = this.o, list = this.list
        this.title.textContent = o.title
        this.t3k.style.display = o.t3k ? '' : 'none'
        var keep = list.scrollTop
        list.innerHTML = ''
        o.items.forEach(function (it) {
            var r = el('button', 'nhe-row nhe-row--wide nhe-row--' + it.kind + (it.selected ? ' is-selected' : ''), list)
            r.type = 'button'
            r.title = it.name
            el('span', 'nhe-row__lead', r, icon(FILE_ICON[it.kind]))
            el('span', 'nhe-row__label', r).textContent = it.name
            r.addEventListener('click', function () { if (typeof o.onPick === 'function') o.onPick(it.value, it) })
        })
        list.scrollTop = keep
    }

    FileList.prototype.update = function (options) { this.o = mix(this.o, options || {}); this.render() }

    NHE.FileList = FileList
    NHE.Toggle = Toggle
    NHE.Trigger = Trigger
    NHE.PluginHeader = PluginHeader
    NHE.OptionList = OptionList
    NHE.Segmented = Segmented
    NHE.PresetList = PresetList
    NHE.ControlBase = Base
    NHE.controlHelpers = { el: el, mix: mix, icon: icon, extend: extend }
})();
