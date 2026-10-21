// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE's menu bars (docs/menus-spec.md): a top and a bottom bar in place of
 * MOD's, on MOD's builder and NHE's alike. Desktop / tablet layout for now
 * (Figma "Touch friendly constructor menus"); the phone's comes next.
 *
 * Every item drives MOD's own button or icon through NHE.mod (menuAction),
 * so MOD's dialogs, checks and notices run unchanged; MOD's bars stay in
 * the page, hidden, and NHE's are mounted inside them.
 *
 * SET → Menus chooses NHE's or MOD's (remembered in this browser; NHE's by
 * default). In the console:  NHE.menus.set('mod')  /  NHE.menus.set('nhe')
 */
NHE.register('bars', function (mod) {
    var KEY = 'nhe-menus'
    var I = NHE.icons
    var saved = function () { try { return localStorage.getItem(KEY) === 'mod' ? 'mod' : 'nhe' } catch (e) { return 'nhe' } }

    var btn = function (cls, icon, label, title) {
        var b = $('<button type="button">').addClass(cls).html((icon || '') + (label ? '<span>' + label + '</span>' : ''))
        if (title) b.attr({ title: title, 'aria-label': title })
        return b
    }

    // ---- top bar -------------------------------------------------------------

    var top = $('<div class="nhe-ctl nhe-menus nhe-topbar">')
    $('<span class="nhe-topbar__logo">').css('background-image', 'url("' + mod.logoUrl() + '")').appendTo(top)
    var title = $('<span class="nhe-topbar__title">').appendTo(top)
    var acts = $('<div class="nhe-topbar__actions">').appendTo(top)
    var bNew = btn('nhe-menus__btn nhe-menus__btn--label', I.sparkle, 'New', 'New pedalboard').appendTo(acts)
    var bSnap = btn('nhe-menus__btn', I.camera, '', 'Snapshots').appendTo(acts)
    var bSave = btn('nhe-menus__btn nhe-topbar__save', I.save, '', 'Save').appendTo(acts)
    var bShare = btn('nhe-menus__btn', I.share, '', 'Share').appendTo(acts)
    var chips = $('<div class="nhe-snapchips">').appendTo(top)

    bNew.on('click', function () { closePanel(); mod.menuAction('new') })
    bShare.on('click', function () { closePanel(); mod.menuAction('share') })

    // the drop-down panels under the bar, at the right (Save, Snapshots):
    // two choices with radio buttons, Cancel / Save
    var panel = null, panelFor = null
    var closePanel = function () {
        if (panel) panel.remove()
        panel = panelFor = null
        top.find('.nhe-menus__btn').removeClass('is-open')
    }
    var openPanel = function (which, button, choices, extra) {
        if (panelFor === which) { closePanel(); return }
        closePanel()
        panelFor = which
        button.addClass('is-open')
        panel = $('<div class="nhe-menupanel" role="dialog">').attr('aria-label', button.attr('title')).appendTo(top)
        var pick = 0
        var rows = choices.map(function (c, i) {
            var r = $('<button type="button" class="nhe-menupanel__choice">').html('<span class="nhe-menupanel__radio"></span>' + (c.icon || '') + '<span class="nhe-menupanel__label"></span>').appendTo(panel)
            r.find('.nhe-menupanel__label').text(c.label)
            if (c.note) $('<span class="nhe-menupanel__note">').text(c.note).appendTo(r)
            r.on('click', function () { pick = i; rows.forEach(function (x, j) { x.toggleClass('is-on', j === i) }) })
            return r
        })
        rows[0].addClass('is-on')
        var foot = $('<div class="nhe-menupanel__buttons">').appendTo(panel)
        foot.append(NHE.textButton('Cancel', 'secondary', closePanel))
        foot.append(NHE.textButton('Save', 'primary', function () { var c = choices[pick]; closePanel(); c.run() }))
        if (extra) extra(panel)
    }
    bSave.on('click', function () {
        openPanel('save', bSave, [
            { icon: I.save, label: 'Save', note: mod.boardName(), run: function () { mod.menuAction('save') } },
            { icon: I.saveAs, label: 'Save as', run: function () { mod.menuAction('saveAs') } }
        ])
    })
    bSnap.on('click', function () {
        openPanel('snapshots', bSnap, [
            { icon: I.save, label: 'Save snapshot', run: function () { mod.menuAction('snapshotSave') } },
            { icon: I.saveAs, label: 'Save snapshot as', run: function () { mod.menuAction('snapshotSaveAs') } }
        ], function (p) {
            $('<button type="button" class="nhe-menupanel__link">').text('Load / manage snapshots').appendTo(p)
                .on('click', function () { closePanel(); mod.menuAction('snapshotManage') })
        })
    })
    // a press anywhere else closes a panel; so does Escape
    $(document).on('pointerdown', function (e) { if (panel && !$(e.target).closest('.nhe-menupanel, .nhe-topbar__actions').length) closePanel() })
    $(document).on('keydown', function (e) { if (panel && e.key === 'Escape') closePanel() })

    // the board's snapshots as chips under the bar: a tap loads one
    var renderChips = function () {
        mod.snapshots(function (list) {
            chips.empty()
            if (list.length < 2) return
            var cur = mod.snapshotCurrent()
            list.forEach(function (s) {
                $('<button type="button" class="nhe-snapchip">').text(s.name).toggleClass('is-on', s.id === cur).appendTo(chips)
                    .on('click', function () { if (s.id !== mod.snapshotCurrent()) mod.loadSnapshot(s.id) })
            })
        })
    }

    // ---- bottom bar ----------------------------------------------------------

    var bottom = $('<div class="nhe-ctl nhe-menus nhe-bottombar">')
    var nav = $('<div class="nhe-bottombar__nav">').appendTo(bottom)
    var NAV = [
        ['constructor', I.puzzle, 'Constructor'], ['library', I.book, 'Library'], ['banks', I.banks, 'Banks'],
        ['files', I.folderOpen, 'File manager'], ['store', I.cart, 'Store']
    ]
    var navBtns = {}
    NAV.forEach(function (n) {
        navBtns[n[0]] = btn('nhe-menus__btn nhe-bottombar__screen', n[1], n[2], n[2]).appendTo(nav).on('click', function () { mod.menuAction(n[0]) })
    })

    var right = $('<div class="nhe-bottombar__right">').appendTo(bottom)
    // MOD's device-only items and NHE's performance view (not in the
    // designs: small icons here; docs/menus-spec.md)
    var extras = $('<div class="nhe-bottombar__extras">').appendTo(right)
    var EXTRA = [
        ['bypass1', null, 'Bypass 1'], ['bypass2', null, 'Bypass 2'], ['midiPorts', I.midi, 'MIDI ports'],
        ['devices', I.device, 'Devices'], ['settings', I.gear, 'Settings'], ['update', null, 'Update']
    ]
    var extraBtns = {}
    EXTRA.forEach(function (x) {
        extraBtns[x[0]] = btn('nhe-menus__btn nhe-bottombar__extra' + (x[1] ? '' : ' is-text'), x[1], x[1] ? '' : x[2], x[2]).appendTo(extras).on('click', function () { mod.menuAction(x[0]) })
    })

    var meters = $('<div class="nhe-meters" title="CPU and RAM">').appendTo(right)
    $('<span class="nhe-meters__icon">').html(I.meters).appendTo(meters)
    var bars = $('<span class="nhe-meters__bars">').appendTo(meters)
    var meter = function (label, cls) {
        var row = $('<span class="nhe-meters__row ' + cls + '">').appendTo(bars)
        $('<span class="nhe-meters__label">').text(label).appendTo(row)
        var track = $('<span class="nhe-meters__track">').appendTo(row)
        var fill = $('<span class="nhe-meters__fill">').appendTo(track)
        var value = $('<span class="nhe-meters__value">').appendTo(row)
        return { fill: fill, value: value }
    }
    var cpu = meter('CPU', 'is-cpu'), ram = meter('RAM', 'is-ram')
    var xruns = $('<span class="nhe-meters__xruns">').appendTo(meters)

    var bTempo = btn('nhe-menus__btn nhe-menus__btn--label nhe-bottombar__tempo', I.metronome, '120bpm', 'Tempo and sync').appendTo(right).on('click', function () { mod.menuAction('tempo') })
    var bPlay = btn('nhe-menus__btn', I.play, '', 'Play').appendTo(right).on('click', function () { mod.setRolling(!mod.rolling()); renderTransport() })
    var bCv = btn('nhe-menus__btn', I.cv, '', 'Manage CV ports').appendTo(right).on('click', function () { mod.menuAction('cv') })
    var bPerf = btn('nhe-menus__btn', I.bolt, '', 'Performance view').appendTo(right).on('click', function () { mod.menuAction('performance') })
    var bReport = btn('nhe-menus__btn', I.report, '', 'Report a problem').appendTo(right).on('click', function () { mod.menuAction('report') })

    // ---- following MOD -------------------------------------------------------

    var renderMenus = function () {
        title.text(mod.boardName())
        var share = mod.menuItem('share'), save = mod.menuItem('save')
        bShare.toggle(!!share.shown)
        bSave.toggleClass('is-modified', !!save.modified)
        NAV.forEach(function (n) {
            var it = mod.menuItem(n[0]), b = navBtns[n[0]]
            b.toggle(!!it.shown).toggleClass('is-selected', !!it.selected).toggleClass('is-greyed', !!it.greyed)
        })
        EXTRA.forEach(function (x) {
            var it = mod.menuItem(x[0]), b = extraBtns[x[0]]
            // on a device only: MOD shows them there (display), never on MOD Desktop
            b.toggle(!!it.shown && $(document.getElementById({ bypass1: 'mod-bypassLeft', bypass2: 'mod-bypassRight', midiPorts: 'mod-show-midi-port', devices: 'mod-devices', settings: 'mod-settings', update: 'mod-update' }[x[0]])).is(':visible'))
            if (x[0] === 'bypass1' || x[0] === 'bypass2') b.toggleClass('is-on', !!it.on)
        })
        var perf = mod.menuItem('performance')
        bPerf.toggle(!!perf.shown).toggleClass('is-selected', !!perf.selected)
        var cv = mod.menuItem('cv')
        bCv.toggle(!!cv.shown)
    }
    var pct = function (v) { return v == null || isNaN(v) ? null : Math.max(0, Math.min(100, v)) }
    var renderStats = function (st) {
        st = st || mod.stats()
        ;[[cpu, pct(st.cpu)], [ram, pct(st.ram)]].forEach(function (m) {
            m[0].fill.css('width', (m[1] || 0) + '%')
            m[0].value.text(m[1] == null ? '–' : Math.round(m[1]) + '%')
        })
        xruns.text((st.xruns || 0) + ' xruns').toggle(!!st.xruns)
    }
    var renderTempo = function () {
        var t = mod.tempo()
        bTempo.find('span').text(Math.round(t.bpm) + 'bpm')
        renderTransport()
    }
    var renderTransport = function () {
        var on = mod.rolling()
        bPlay.html(on ? I.pause : I.play).attr({ title: on ? 'Stop' : 'Play', 'aria-label': on ? 'Stop' : 'Play' }).toggleClass('is-selected', on)
    }

    // ---- NHE's or MOD's ------------------------------------------------------

    var mounted = false
    var apply = function () {
        var on = saved() === 'nhe'
        if (on && !mounted) { mod.mountMenus(top, bottom); mounted = true }
        top.toggle(on)
        bottom.toggle(on)
        mod.coverMenus(on)
        $('body').toggleClass('nhe-menus-on', on)
        if (on) { renderMenus(); renderStats(); renderTempo(); renderChips() } else closePanel()
    }
    NHE.menus = {
        current: saved,
        set: function (v) {
            try { localStorage.setItem(KEY, v === 'mod' ? 'mod' : 'nhe') } catch (e) {}
            apply()
            return saved()
        }
    }

    mod.onMenusChange(function () { if (saved() === 'nhe') renderMenus() })
    mod.onBoardName(function () { if (saved() === 'nhe') { renderMenus(); renderChips() } })
    mod.onSnapshots(function () { if (saved() === 'nhe') renderChips() })
    mod.onStats(function (st) { if (saved() === 'nhe') renderStats(st) })
    mod.onTempo(function () { if (saved() === 'nhe') renderTempo() })
    apply()
})
