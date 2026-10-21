// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE controls besides the slider. Specs: docs/button-spec.md and
 * docs/select-spec.md. Needs theme/tokens.css, components/icons.js and
 * components/controls/controls.css.
 *
 *   new NHE.Toggle(el, { title, value: true|false, binding, onChange, onSettings, onBlocked })
 *   new NHE.Trigger(el, { title, binding, onTrigger, onSettings, onBlocked })
 *   new NHE.PluginHeader(el, { name, on: true|false, binding, onChange, onSettings, onBlocked,
 *                              onColour, onInfo, onDelete })   // the last three: a row of icons
 *                                                              // under the name, each when given
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
        n.nameText = el('span', 'nhe-plugin-header__text', n.name)
        // a row of icons under the name: the plugin's colour (colour.js), its
        // info, delete it; each when the host offers it
        var tools = [['onColour', 'palette', 'Plugin colour'], ['onInfo', 'info', 'Plugin info'], ['onDelete', 'remove', 'Delete plugin']]
            .filter(function (t) { return typeof self.o[t[0]] === 'function' })
        if (tools.length) {
            n.tools = el('div', 'nhe-plugin-header__tools', root)
            tools.forEach(function (t) {
                var b = NHE.iconButton(t[1], { label: t[2], onClick: function () { self.emit(t[0]) } })
                b.title = t[2]
                b.classList.add('nhe-plugin-header__tool', 'nhe-plugin-header__tool--' + t[1])
                n.tools.appendChild(b)
            })
        }
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
        this.n.nameText.textContent = this.o.name
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
        // the presets' settings (addressing) at the end of the action row
        this.footer(acts)
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
        this.t3k = NHE.textButton('Browse T3K', 'primary', function () { if (typeof self.o.onT3K === 'function') self.o.onT3K() })
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

/*
 * Drag to scroll, with NHE's own pointer handling: MOD cancels every
 * touchmove on the page (desktop.js), so the browser never scrolls anything
 * under a finger, and a mouse never drag-scrolls anyway.
 *
 *   NHE.dragScroll(root, { x: true })   // x: also pan root sideways
 *
 * The first few px decide the axis. Up/down scrolls the nearest element
 * that scrolls vertically (a list, or root itself); sideways pans root, but
 * not from a control (button, readout) outside a list. A drag never starts
 * on an input or a slider thumb, and swallows the click that follows it.
 * Listens on the document while dragging, as the slider does.
 */
(function () {
    var NHE = window.NHE = window.NHE || {}

    var START = 6                                      // px of travel before a press becomes a drag
    var CONTROL = 'button, a, [tabindex]'
    var NEVER = 'input, textarea, select, .nhe-slider__thumb, .nhe-range'

    NHE.dragScroll = function (root, options) {
        var o = options || {}
        var drag = null

        var scrollerY = function (n) {
            for (; n && n.nodeType === 1; n = n.parentNode) {
                if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n
                if (n === root) break
            }
            return null
        }
        var onMove = function (e) {
            if (!drag || e.pointerId !== drag.id) return
            var dx = e.clientX - drag.x, dy = e.clientY - drag.y
            if (!drag.axis) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) < START) return
                if (Math.abs(dy) > Math.abs(dx)) {
                    if (!drag.list) { onUp(e); return }
                    drag.axis = 'y'
                } else {
                    if (!o.x || drag.onControl || root.scrollWidth <= root.clientWidth) { onUp(e); return }
                    drag.axis = 'x'
                }
                root.classList.add('is-dragging-scroll')
            }
            e.preventDefault()
            if (drag.axis === 'x') root.scrollLeft = drag.left - dx
            else drag.list.scrollTop = drag.top - dy / drag.scale
        }
        var onUp = function (e) {
            if (!drag || (e && e.pointerId !== drag.id)) return
            var moved = !!drag.axis
            drag = null
            root.classList.remove('is-dragging-scroll')
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('pointercancel', onUp)
            if (moved) {
                var swallow = function (ev) { ev.stopPropagation(); ev.preventDefault() }
                root.addEventListener('click', swallow, true)
                setTimeout(function () { root.removeEventListener('click', swallow, true) }, 0)
            }
        }
        root.addEventListener('pointerdown', function (e) {
            if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return
            var t = e.target
            if (!t.closest || t.closest(NEVER)) return
            var list = scrollerY(t)
            var onControl = !!t.closest(CONTROL)
            if (onControl && !list) return       // a button, toggle or readout: leave it alone
            // a list inside a scaled panel scrolls in its own px: divide the
            // pointer's on-screen move by the scale
            var scale = list && list.offsetHeight ? list.getBoundingClientRect().height / list.offsetHeight : 1
            drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: root.scrollLeft,
                     list: list, top: list ? list.scrollTop : 0, onControl: onControl, axis: null, scale: scale || 1 }
            document.addEventListener('pointermove', onMove)
            document.addEventListener('pointerup', onUp)
            document.addEventListener('pointercancel', onUp)
        })
    }
})();

/*
 * Scale for phones held upright. MOD's page has no viewport tag, so a phone
 * lays it out 980 px wide and shrinks it to fit: upright, NHE's screens get
 * very tall and their sliders long and thin. Upright, the screens and
 * dialogs are scaled up (CSS transform, which every browser measures the
 * same way) so about ZOOM_TARGET px fill the width: the system bar, the
 * presets column and one slider. Sideways and on a computer: 1.
 *
 *   NHE.zoom()   // the current factor; CSS reads it as var(--nhe-zoom)
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var ZOOM_TARGET = 540, ZOOM_MAX = 3      // 540: bar, presets, one slider, and room for the NHE / MOD switch

    NHE.zoom = function () {
        var w = window.innerWidth, h = window.innerHeight
        if (h <= w) return 1
        return Math.max(1, Math.min(ZOOM_MAX, w / ZOOM_TARGET))
    }
    // the plugin settings screen: a little larger again everywhere (its text
    // and icons were on the small side); CSS: var(--nhe-settings-zoom)
    var SETTINGS_SCALE = 1.15
    NHE.settingsZoom = function () { return NHE.zoom() * SETTINGS_SCALE }
    var apply = function () {
        document.documentElement.style.setProperty('--nhe-zoom', NHE.zoom())
        document.documentElement.style.setProperty('--nhe-settings-zoom', NHE.settingsZoom())
    }
    apply()
    window.addEventListener('resize', function (e) { if (e.target === window) apply() })
    window.addEventListener('orientationchange', apply)
})();

/*
 * Dialogs that fit the screen. Every NHE dialog is a .nhe-dialog-overlay
 * put straight into <body>; this watches for them. On a touch screen (a
 * phone or a tablet: no hover, a coarse pointer) each one runs full screen;
 * elsewhere it stays a centred card unless it would spill over the window,
 * then it goes full screen too (also when it grows, or the window shrinks).
 * Full screen is sized in px from the window, divided by the dialog's own
 * CSS zoom: Safari multiplies a zoomed box's percentage sizes by its zoom,
 * so 100% could run off the screen.
 *
 *   NHE.fitDialog(overlay)   // again, by hand (the watcher does it on its own)
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var DIALOG = '.nhe-dialog, .nhe-add'
    var touch = function () { return !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) }

    NHE.fitDialog = function (overlay) {
        var d = overlay && overlay.querySelector(DIALOG)
        if (!d || !overlay.parentNode) return
        var full = touch()
        if (!full) {
            // as a card: does it spill?
            overlay.classList.remove('is-full')
            d.classList.remove('is-full')
            d.style.width = d.style.height = ''
            var r = d.getBoundingClientRect(), o = overlay.getBoundingClientRect()
            full = r.height > o.height + 1 || r.width > o.width + 1 || r.top < o.top - 1 || r.left < o.left - 1
        }
        overlay.classList.toggle('is-full', full)
        d.classList.toggle('is-full', full)
        if (!full) return
        // its zoom as full screen (the + dialog only zooms then)
        var z = parseFloat(getComputedStyle(d).zoom) || 1, box = overlay.getBoundingClientRect()
        d.style.width = box.width / z + 'px'
        d.style.height = box.height / z + 'px'
    }

    var watch = function () {
        var fitAll = function () {
            var list = document.querySelectorAll('body > .nhe-dialog-overlay')
            for (var i = 0; i < list.length; i++) NHE.fitDialog(list[i])
        }
        new MutationObserver(function (records) {
            records.forEach(function (rec) {
                for (var i = 0; i < rec.addedNodes.length; i++) {
                    var n = rec.addedNodes[i]
                    if (!n.classList || !n.classList.contains('nhe-dialog-overlay')) continue
                    NHE.fitDialog(n)
                    // a card that grows later (another assignment type, a field shown)
                    var d = n.querySelector(DIALOG)
                    if (d && window.ResizeObserver) new ResizeObserver(function () { if (!touch()) NHE.fitDialog(n) }).observe(d)
                }
            })
        }).observe(document.body, { childList: true })
        window.addEventListener('resize', function (e) { if (e.target === window) fitAll() })
        window.addEventListener('orientationchange', function () { setTimeout(fitAll, 300) })
    }
    if (window.MutationObserver && document.body) watch()
})();
