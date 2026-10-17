// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Performance view: wiring into MOD's page through NHE.mod.
 * The view itself is performance.js / performance.css (shared with the
 * performance-view branch of Kiwooky/mod-ui). NHE adds the back of a
 * flipped pedal: its settings screen (docs/performance-flip-spec.md).
 */
NHE.register('performance', function (mod) {
    mod.guardPedalboard()

    var trigger = mod.addFooterIcon('mod-performance', 'Performance view')
    var view = mod.addView('performance-view',
        '<div style="display:none">' +
            '<div class="performance-stage">' +
                '<div class="performance-track"></div>' +
                '<div class="performance-empty" style="display:none">No plugins on this pedalboard</div>' +
            '</div>' +
        '</div>')

    mod.desktop().performanceView = new PerformanceView({
        pedalboard: mod.pedalboard(),
        view: view,
        trigger: trigger,
        exitTrigger: mod.constructorIcon(),
        // the back of a flipped pedal is NHE's settings screen (the settings
        // feature); without it, the view shows MOD's settings panel there
        renderBack: function (instance, container, api) {
            if (!NHE.settingsScreen) return false
            mod.fullBleed('performance-back', true)
            NHE.settingsScreen.mount(instance, container, {
                exit: function () { api.flipBack() },        // the system bar's EXIT flips back
                hop: function (id) { api.flipTo(id) },       // the chain: straight to that pedal's back
            })
            return true
        },
    })

    // the back closes (Flip, leaving the view): give MOD's page its edges back
    var pv = mod.desktop().performanceView
    ;['flipBack', 'close'].forEach(function (m) {
        var original = pv[m]
        pv[m] = function () {
            var r = original.apply(this, arguments)
            if (!pv.isFlipped()) mod.fullBleed('performance-back', false)
            return r
        }
    })
})
