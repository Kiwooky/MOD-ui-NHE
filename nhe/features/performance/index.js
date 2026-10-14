// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Performance view: wiring into MOD's page through NHE.mod.
 * The view itself is performance.js / performance.css (shared with the
 * performance-view branch of Kiwooky/mod-ui).
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
            '<div class="performance-strip"></div>' +
        '</div>')

    mod.desktop().performanceView = new PerformanceView({
        pedalboard: mod.pedalboard(),
        view: view,
        trigger: trigger,
        exitTrigger: mod.constructorIcon(),
    })
})
