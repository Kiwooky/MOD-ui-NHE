// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Connect dialog: what one of a plugin's jacks (or a pair, "Wet L/R") is
 * plugged into, as a tick list. For an output, the other pedals' inputs and
 * the device's outputs; for an input, their outputs and the device's inputs.
 * A tick connects, an untick disconnects, at once. Opened from the system
 * bar's Chain tab (a port's heading or its "Not connected"). Needs
 * controls.js and controls.css.
 *
 *   NHE.PortsDialog({
 *       plugin: 'Temporal Rift', accent: null | '#rrggbb',
 *       dir: 'output' | 'input',
 *       sections: [{ title: 'Wet (L)', port: portId,
 *                    groups: [{ name, brand, device, jacks: [{ port, name, on }] }] }],
 *       onToggle: fn(port, other, on, done(ok)),   // connect / disconnect; done when the host answered
 *       onClose: fn()
 *   })
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon

    NHE.PortsDialog = function (options) {
        var o = mix({ plugin: '', accent: null, dir: 'output', sections: [] }, options || {})
        var out = o.dir === 'output'
        var overlay = el('div', 'nhe-ctl nhe-dialog-overlay', document.body)
        var d = el('div', 'nhe-dialog nhe-ports-dialog', overlay)
        d.setAttribute('role', 'dialog')
        d.setAttribute('aria-modal', 'true')
        d.setAttribute('aria-label', (out ? 'Connect outputs of ' : 'Connect inputs of ') + o.plugin)
        d.setAttribute('tabindex', '-1')
        if (o.accent && NHE.accent) NHE.accent.apply(overlay, o.accent)

        var head = el('div', 'nhe-dialog__header', d)
        el('span', 'nhe-dialog__plugin', head).textContent = o.plugin
        el('span', 'nhe-dialog__pill', head).textContent = out ? 'Output' : 'Input'

        var f = el('div', 'nhe-dialog__field nhe-ports-dialog__body', d)
        o.sections.forEach(function (sec) {
            var t = el('div', 'nhe-dialog__title', f, icon(out ? 'signOut' : 'signIn') + '<span></span>')
            t.lastChild.textContent = sec.title + (out ? ' goes to' : ' comes from')
            if (!sec.groups.length) { el('div', 'nhe-dialog__note', f).textContent = 'Nothing on the board to connect it to.'; return }
            sec.groups.forEach(function (g) {
                var grp = el('div', 'nhe-ports-dialog__group', f)
                var gh = el('div', 'nhe-ports-dialog__owner', grp)
                if (g.brand) el('span', 'nhe-ports-dialog__brand', gh).textContent = g.brand
                el('span', 'nhe-ports-dialog__name', gh).textContent = g.name
                g.jacks.forEach(function (j) {
                    var b = el('button', 'nhe-ports-dialog__jack', grp)
                    b.type = 'button'
                    el('span', 'nhe-ports-dialog__tick', b, icon('tick'))
                    el('span', 'nhe-ports-dialog__label', b).textContent = j.name
                    var show = function () { b.classList.toggle('is-on', !!j.on); b.setAttribute('aria-pressed', j.on ? 'true' : 'false') }
                    show()
                    b.addEventListener('click', function () {
                        if (b.classList.contains('is-busy')) return
                        var want = !j.on
                        b.classList.add('is-busy')
                        j.on = want
                        show()
                        o.onToggle(sec.port, j.port, want, function (ok) {
                            b.classList.remove('is-busy')
                            if (!ok) { j.on = !want; show() }
                        })
                    })
                })
            })
        })

        var close = function () {
            if (!overlay.parentNode) return
            overlay.parentNode.removeChild(overlay)
            if (typeof o.onClose === 'function') o.onClose()
        }
        var foot = el('div', 'nhe-dialog__buttons', d)
        var done = NHE.textButton('Close', 'primary', close)
        foot.appendChild(done)

        d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } })
        // MOD listens for keys on the page: keep ours in here
        d.addEventListener('keyup', function (e) { e.stopPropagation() })
        overlay.addEventListener('pointerdown', function (e) { if (e.target === overlay) close() })
        if (NHE.dragScroll) NHE.dragScroll(d)
        setTimeout(function () { d.focus() }, 0)
    }
})();
