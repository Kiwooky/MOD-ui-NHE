// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Name dialog: asks for a name, in the addressing dialog's frame (plugin
 * name with a pill, a titled text field, Cancel / Save). Used for a preset's
 * Save as and Rename. Needs controls.js and controls.css.
 *
 *   NHE.NameDialog({
 *       plugin: 'Dragonfly Hall', pill: 'Save as',
 *       title: 'Preset name', icon: 'saveAs', value: 'Large Hall',
 *       accent: null | '#rrggbb',      // the plugin's colour (colour.js)
 *       onSave: fn(name)               // the trimmed name, never empty
 *   })
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon

    var Dialog = function (options) {
        var self = this
        this.o = mix({ plugin: '', pill: '', title: 'Name', icon: 'rename', value: '', accent: null }, options || {})
        var overlay = this.overlay = el('div', 'nhe-ctl nhe-dialog-overlay', document.body)
        var d = el('div', 'nhe-dialog nhe-name-dialog', overlay)
        d.setAttribute('role', 'dialog')
        d.setAttribute('aria-modal', 'true')
        d.setAttribute('aria-label', this.o.pill || this.o.title)
        if (this.o.accent && NHE.accent) NHE.accent.apply(overlay, this.o.accent)

        var head = el('div', 'nhe-dialog__header', d)
        el('span', 'nhe-dialog__plugin', head).textContent = this.o.plugin
        if (this.o.pill) el('span', 'nhe-dialog__pill', head).textContent = this.o.pill

        var f = el('div', 'nhe-dialog__field', d)
        el('div', 'nhe-dialog__title', f, icon(this.o.icon) + '<span>' + this.o.title + '</span>')
        var input = this.input = el('input', 'nhe-dialog__input', f)
        input.type = 'text'
        input.value = this.o.value || ''
        input.setAttribute('autocomplete', 'off')
        input.setAttribute('spellcheck', 'false')

        var foot = el('div', 'nhe-dialog__buttons', d)
        foot.appendChild(NHE.textButton('Cancel', 'secondary', function () { self.close() }))
        var save = this.saveButton = NHE.textButton('Save', 'primary', function () { self.save() })
        foot.appendChild(save)
        var update = function () { save.disabled = !$trim(input.value) }
        input.addEventListener('input', update)
        update()

        d.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); self.close() }
            else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); self.save() }
        })
        // MOD listens for keys on the page: keep ours in here
        d.addEventListener('keyup', function (e) { e.stopPropagation() })
        setTimeout(function () { input.focus(); input.select() }, 0)
    }

    var $trim = function (s) { return String(s || '').replace(/^\s+|\s+$/g, '') }

    Dialog.prototype.save = function () {
        var name = $trim(this.input.value)
        if (!name) return
        this.close()
        if (typeof this.o.onSave === 'function') this.o.onSave(name)
    }

    Dialog.prototype.close = function () {
        if (!this.overlay) return
        this.overlay.parentNode.removeChild(this.overlay)
        this.overlay = null
    }

    NHE.NameDialog = function (options) { return new Dialog(options) }
})();
