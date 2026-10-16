// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE slider: the control that replaces MOD's knob (.mod-knob) in the plugin
 * settings panel. Spec: docs/slider-spec.md. Needs theme/tokens.css,
 * components/slider/slider.css and components/icons.js.
 *
 *   var s = new NHE.Slider(element, {
 *       title: 'Tone', value: 65, min: 0, max: 100, unit: '%',
 *       integer: false, logarithmic: false, rangeSteps: 0, decimals: 2,
 *       minimised: false,
 *       group: { kind: 'none'|'single'|'start'|'middle'|'end', name: '', color: 0, width: 360 },
 *       binding: null | { type: 'midi'|'cv'|'device'|'chain', kind: 'MIDI', label: 'CC 7 · Ch 1',
 *                         locked: false },   // locked: the source takes no feedback (MOD: CV)
 *       onInput: fn(value),     // while dragging, typing, wheel, keys
 *       onChange: fn(value),    // when a gesture ends
 *       onSettings: fn(),       // settings icon
 *       onBlocked: fn()         // touch refused while locked
 *   })
 *   s.setValue(v)        // from outside (host feedback, MIDI): no callbacks;
 *                        // ignored while a finger is on the thumb or a value is being typed
 *   s.update(options)    // change any option
 *   s.destroy()
 *
 * Behaviour (spec decisions): only the thumb drags, following the finger from
 * where it was grabbed (no jumps); hold the thumb ~400 ms without moving for
 * fine adjustment (10x finer; Shift-drag on desktop); a tap does nothing; the
 * readout is tapped to type a value. Plain ES5 on purpose.
 */
(function () {
    var NHE = window.NHE = window.NHE || {}

    var HOLD_MS = 400          // hold before fine adjustment
    var HOLD_SLOP = 4          // px of movement that cancels the hold
    var FINE = 10              // fine adjustment is this much finer
    var BLOCKED_MS = 600       // how long the blocked look stays
    var INFO_MS = 2000         // how long the binding overlay stays
    var MAX_TICKS = 12         // above this many positions, no tick marks
    var FITS = ['max', 'compact', 'tight']

    var clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

    var el = function (tag, cls, parent) {
        var e = document.createElement(tag)
        if (cls) e.className = cls
        if (parent) parent.appendChild(e)
        return e
    }

    var Slider = function (root, options) {
        this.root = root
        this.o = {
            title: '', value: 0, min: 0, max: 1, unit: '', decimals: 2,
            integer: false, logarithmic: false, rangeSteps: 0,
            minimised: false, group: null, binding: null
        }
        this.timers = {}
        this.build()
        this.update(options || {})
    }

    Slider.prototype.build = function () {
        var self = this
        var r = this.root
        r.classList.add('nhe-slider')
        r.innerHTML = ''
        var n = this.n = {}

        el('div', 'nhe-slider__bg', r)

        var band = el('div', 'nhe-slider__band', r)
        el('div', 'nhe-slider__bar', band)
        n.groupName = el('div', 'nhe-slider__group-name', band)

        var header = el('div', 'nhe-slider__header', r)
        n.title = el('span', null, el('div', 'nhe-slider__title', header))
        n.readout = el('div', 'nhe-slider__readout', header)
        n.readout.setAttribute('tabindex', '0')
        n.readout.setAttribute('role', 'button')
        n.reading = el('span', 'nhe-slider__reading', n.readout)
        n.value = el('span', 'nhe-slider__value', n.reading)
        n.unit = el('span', 'nhe-slider__unit', n.reading)
        n.magnifier = el('span', 'nhe-slider__magnifier', n.readout)
        n.magnifier.innerHTML = NHE.icons.magnifier
        n.input = el('input', 'nhe-slider__input', n.readout)
        n.input.type = 'text'
        n.input.setAttribute('inputmode', 'decimal')
        n.input.setAttribute('enterkeyhint', 'done')

        var rail = el('div', 'nhe-slider__rail', r)
        n.ticks = el('div', 'nhe-slider__ticks', rail)
        n.track = el('div', 'nhe-slider__track', rail)
        el('div', 'nhe-slider__lower', n.track)
        n.fill = el('div', 'nhe-slider__fill', n.track)
        el('div', 'nhe-slider__zero', n.track)
        n.thumb = el('div', 'nhe-slider__thumb', n.track)
        n.thumb.setAttribute('tabindex', '0')
        n.thumb.setAttribute('role', 'slider')
        var knob = el('div', 'nhe-slider__knob', n.thumb)
        el('div', 'nhe-slider__inner', knob)
        n.thumbIcon = el('span', 'nhe-slider__thumb-icon', knob)

        var footer = el('div', 'nhe-slider__footer', r)
        n.settings = el('button', 'nhe-slider__button nhe-slider__settings', footer)
        n.settings.type = 'button'
        n.settings.setAttribute('aria-label', 'Slider settings')
        n.settings.innerHTML = NHE.icons.settings
        n.binding = el('button', 'nhe-slider__button nhe-slider__binding', footer)
        n.binding.type = 'button'

        n.overlay = el('div', 'nhe-slider__overlay', r)
        n.overlayKind = el('span', 'nhe-slider__overlay-kind', n.overlay)
        n.overlayLabel = el('span', 'nhe-slider__overlay-label', n.overlay)
        n.overlayStatus = el('span', 'nhe-slider__overlay-status', n.overlay)

        // --- thumb: drag, hold for fine, Shift for fine
        var drag = null
        var onDown = function (e) {
            if (e.button !== undefined && e.button !== 0) return
            e.preventDefault()
            if (self.o.minimised) return
            if (self.locked()) { self.blocked(); return }
            try { n.thumb.setPointerCapture(e.pointerId) } catch (err) {}
            n.thumb.focus({ preventScroll: true })
            drag = { id: e.pointerId, y: e.clientY, x: e.clientX, pos: self.pos, moved: false, fine: false }
            self.state('dragging', true)
            self.timers.hold = setTimeout(function () {
                if (drag && !drag.moved) { drag.held = true; self.fine(drag, true) }
            }, HOLD_MS)
        }
        var onMove = function (e) {
            if (!drag || e.pointerId !== drag.id) return
            var dy = drag.y - e.clientY
            if (!drag.moved && (Math.abs(dy) > HOLD_SLOP || Math.abs(e.clientX - drag.x) > HOLD_SLOP)) {
                drag.moved = true
                clearTimeout(self.timers.hold)
            }
            // fine: held still before moving, or Shift down (desktop)
            if (drag.moved) self.fine(drag, drag.held || e.shiftKey, e.clientY)
            var travel = self.travel()
            if (!travel) return
            var pos = clamp(drag.pos + dy / travel / (drag.fine ? FINE : 1), 0, 1)
            self.setPos(pos, true)
        }
        var onUp = function (e) {
            if (!drag || e.pointerId !== drag.id) return
            clearTimeout(self.timers.hold)
            drag = null
            self.state('dragging', false)
            self.state('fine', false)
            if (self.positions()) self.setPos(self.snap(self.pos), true)
            self.emit('onChange')
        }
        n.thumb.addEventListener('pointerdown', onDown)
        n.thumb.addEventListener('pointermove', onMove)
        n.thumb.addEventListener('pointerup', onUp)
        n.thumb.addEventListener('pointercancel', onUp)

        // --- wheel over the whole control; keys on the thumb
        r.addEventListener('wheel', function (e) {
            if (self.o.minimised || self.editing) return
            e.preventDefault()
            if (self.locked()) { self.blocked(); return }
            self.wheelBuffer = (self.wheelBuffer || 0) + e.deltaY
            var notches = self.wheelBuffer < 0 ? Math.ceil(self.wheelBuffer / 40) : Math.floor(self.wheelBuffer / 40)
            if (!notches) return
            self.wheelBuffer -= notches * 40
            self.nudge(-notches, e.shiftKey)
            clearTimeout(self.timers.wheel)
            self.timers.wheel = setTimeout(function () { self.emit('onChange') }, 300)
        }, { passive: false })

        n.thumb.addEventListener('keydown', function (e) {
            if (self.o.minimised) return
            var k = e.key, d = 0
            if (k === 'ArrowUp' || k === 'ArrowRight') d = 1
            else if (k === 'ArrowDown' || k === 'ArrowLeft') d = -1
            else if (k === 'PageUp') d = 10
            else if (k === 'PageDown') d = -10
            else if (k === 'Home') d = -Infinity
            else if (k === 'End') d = Infinity
            else return
            e.preventDefault()
            if (self.locked()) { self.blocked(); return }
            if (d === Infinity || d === -Infinity) self.setPos(d > 0 ? 1 : 0, true)
            else self.nudge(d, e.shiftKey)
            self.emit('onChange')
        })

        // --- readout: tap to type a value
        n.readout.addEventListener('click', function () { self.edit() })
        n.readout.addEventListener('keydown', function (e) {
            if (!self.editing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); self.edit() }
        })
        n.input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); self.commit(true) }
            else if (e.key === 'Escape') { e.preventDefault(); self.commit(false) }
        })
        n.input.addEventListener('blur', function () { if (self.editing) self.commit(true) })

        // --- footer and overlay
        n.settings.addEventListener('click', function () { self.emit('onSettings') })
        n.binding.addEventListener('click', function () { self.info(!self.has('info')) })
        n.overlay.addEventListener('click', function () { self.info(false) })
    }

    // ---- options and rendering --------------------------------------------

    Slider.prototype.update = function (options) {
        var o = this.o, k
        for (k in options) if (Object.prototype.hasOwnProperty.call(options, k)) o[k] = options[k]
        if (o.max <= o.min) o.max = o.min + 1
        this.logScale = !!(o.logarithmic && o.min > 0 && o.max > 0)
        this.bipolar = !this.logScale && o.min < 0 && o.max > 0
        var n = this.n, r = this.root

        n.title.textContent = o.title
        r.title = o.comment || o.title
        this.state('minimised', !!o.minimised)
        this.state('bipolar', this.bipolar)

        var g = o.group || { kind: 'none' }
        r.setAttribute('data-group', g.kind || 'none')
        n.groupName.textContent = g.name || ''
        r.style.setProperty('--nhe-slider-group-color', 'var(--nhe-group-' + (g.color || 0) + ')')
        if (g.width) r.style.setProperty('--nhe-slider-group-width', g.width + 'px')
        else r.style.removeProperty('--nhe-slider-group-width')

        var b = o.binding
        this.state('bound', !!b)
        this.state('locked', !!(b && b.locked))
        if (b) {
            var icon = NHE.icons[b.type] || NHE.icons.midi
            n.binding.innerHTML = icon
            n.thumbIcon.innerHTML = icon
            n.binding.setAttribute('aria-label', 'Bound to ' + (b.kind || '') + ' ' + (b.label || ''))
            n.overlayKind.textContent = b.kind || ''
            n.overlayLabel.textContent = b.label || ''
            n.overlayStatus.textContent = b.locked ? 'Locked' : 'Shared'
        } else {
            this.info(false)
            this.state('blocked', false)
        }

        this.ticks()
        this.setValue(o.value, true)
    }

    // the finger wins: an outside change while dragging or typing is ignored
    Slider.prototype.setValue = function (value, force) {
        if (!force && (this.has('dragging') || this.editing)) return
        this.o.value = this.clampValue(value)
        this.pos = this.posFromValue(this.o.value)
        this.render()
    }

    Slider.prototype.render = function () {
        var o = this.o, r = this.root, s = r.style
        s.setProperty('--pos', this.pos)
        if (this.bipolar) {
            var z = this.posFromValue(0)
            s.setProperty('--zero', z)
            s.setProperty('--lo', Math.min(z, this.pos))
            s.setProperty('--hi', Math.max(z, this.pos))
        }
        this.n.thumb.setAttribute('aria-valuenow', o.value)
        this.n.thumb.setAttribute('aria-valuemin', o.min)
        this.n.thumb.setAttribute('aria-valuemax', o.max)
        this.n.thumb.setAttribute('aria-label', o.title)
        this.n.unit.textContent = o.unit || ''
        this.fit()
    }

    // Readout fit (spec refinement 9): Max, then Compact, then Tight; then drop
    // the unit; then drop decimals.
    Slider.prototype.fit = function () {
        var ro = this.n.readout, rd = this.n.reading, o = this.o
        var decimals = this.decimals()
        ro.classList.remove('is-fit-compact', 'is-fit-tight', 'is-no-unit')
        this.n.value.textContent = this.format(o.value, decimals)
        if (!ro.offsetWidth) return    // not laid out yet
        var cs = getComputedStyle(ro)
        var room = ro.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        var fits = function () { return rd.scrollWidth <= room }
        for (var i = 0; i < FITS.length; i++) {
            if (i) ro.classList.add('is-fit-' + FITS[i])
            if (i > 1) ro.classList.remove('is-fit-' + FITS[i - 1])
            if (fits()) return
        }
        ro.classList.add('is-no-unit')
        while (!fits() && decimals > 0) {
            decimals--
            this.n.value.textContent = this.format(o.value, decimals)
        }
    }

    Slider.prototype.decimals = function () {
        return this.o.integer ? 0 : this.o.decimals
    }

    Slider.prototype.format = function (v, decimals) {
        return Number(v).toFixed(decimals)
    }

    // ---- value <-> position --------------------------------------------------

    Slider.prototype.clampValue = function (v) {
        var o = this.o
        v = parseFloat(v)
        if (isNaN(v)) v = o.min
        v = clamp(v, o.min, o.max)
        if (o.integer) v = Math.round(v)
        return v
    }

    Slider.prototype.posFromValue = function (v) {
        var o = this.o
        if (this.logScale) return Math.log(v / o.min) / Math.log(o.max / o.min)
        return (v - o.min) / (o.max - o.min)
    }

    Slider.prototype.valueFromPos = function (p) {
        var o = this.o
        var v = this.logScale ? o.min * Math.pow(o.max / o.min, p) : o.min + p * (o.max - o.min)
        return this.clampValue(v)
    }

    // number of discrete positions, or 0 for a continuous port
    Slider.prototype.positions = function () {
        var o = this.o
        if (o.rangeSteps >= 2) return o.rangeSteps
        if (o.integer && !this.logScale) return o.max - o.min + 1
        return 0
    }

    Slider.prototype.snap = function (p) {
        var n = this.positions()
        return n >= 2 ? Math.round(p * (n - 1)) / (n - 1) : p
    }

    Slider.prototype.travel = function () {
        return this.n.track.clientHeight - this.n.thumb.offsetHeight
    }

    // stepped ports: the value snaps at once, the thumb follows the finger
    // while dragging and snaps on release
    Slider.prototype.setPos = function (p, user) {
        p = clamp(p, 0, 1)
        var n = this.positions()
        var v = this.valueFromPos(n ? this.snap(p) : p)
        this.pos = n && !this.has('dragging') ? this.snap(p) : p
        var changed = v !== this.o.value
        this.o.value = v
        this.render()
        if (user && changed) this.emit('onInput')
    }

    // one step (a position for stepped ports, 1/100 of travel otherwise)
    Slider.prototype.nudge = function (steps, fine) {
        var n = this.positions()
        var size = n >= 2 ? 1 / (n - 1) : (fine ? 0.001 : 0.01)
        this.setPos((n >= 2 ? this.snap(this.pos) : this.pos) + steps * size, true)
    }

    Slider.prototype.ticks = function () {
        var box = this.n.ticks, n = this.positions()
        box.innerHTML = ''
        if (n < 2 || n > MAX_TICKS) return
        for (var i = 0; i < n; i++) {
            var t = el('div', 'nhe-slider__tick', box)
            t.style.top = (100 - i / (n - 1) * 100) + '%'
        }
    }

    // ---- states ------------------------------------------------------------

    Slider.prototype.has = function (name) {
        return this.root.classList.contains('is-' + name)
    }

    Slider.prototype.state = function (name, on) {
        this.root.classList.toggle('is-' + name, !!on)
        if (name === 'dragging' || name === 'fine' || name === 'editing') {
            var self = this
            // the readout changes size: fit again once it has
            requestAnimationFrame(function () { self.fit() })
        }
    }

    Slider.prototype.fine = function (drag, on, y) {
        if (drag.fine === on) return
        // rebase so the thumb stays under the finger when the gearing changes
        drag.pos = this.pos
        drag.y = y !== undefined ? y : drag.y
        drag.fine = on
        this.state('fine', on)
    }

    Slider.prototype.locked = function () {
        return !!(this.o.binding && this.o.binding.locked)
    }

    // a refused touch on a locked slider: the orange ring, and the overlay
    // saying what it is locked to
    Slider.prototype.blocked = function () {
        var self = this
        this.info(true)
        this.state('blocked', true)
        clearTimeout(this.timers.blocked)
        this.timers.blocked = setTimeout(function () { self.state('blocked', false) }, BLOCKED_MS)
        this.emit('onBlocked')
    }

    Slider.prototype.info = function (on) {
        var self = this
        clearTimeout(this.timers.info)
        this.state('info', on && !!this.o.binding)
        if (on) this.timers.info = setTimeout(function () { self.state('info', false) }, INFO_MS)
    }

    Slider.prototype.edit = function () {
        if (this.editing || this.o.minimised || this.locked()) {
            if (this.locked()) this.blocked()
            return
        }
        this.editing = true
        this.state('editing', true)
        this.n.input.value = this.format(this.o.value, this.decimals())
        this.n.input.focus()
        this.n.input.select()
    }

    Slider.prototype.commit = function (keep) {
        if (!this.editing) return
        this.editing = false
        var text = this.n.input.value
        this.state('editing', false)
        if (keep) {
            var v = parseFloat(text.replace(',', '.'))
            if (!isNaN(v)) {
                var old = this.o.value
                this.setValue(v, true)
                if (this.o.value !== old) { this.emit('onInput'); this.emit('onChange') }
            }
        }
        this.n.readout.focus({ preventScroll: true })
    }

    Slider.prototype.emit = function (name) {
        var fn = this.o[name]
        if (typeof fn === 'function') fn.call(this, this.o.value)
    }

    Slider.prototype.destroy = function () {
        for (var k in this.timers) clearTimeout(this.timers[k])
        this.root.innerHTML = ''
        this.root.className = this.root.className.replace(/\bnhe-slider\S*|\bis-\S+/g, '')
    }

    NHE.Slider = Slider
})();
