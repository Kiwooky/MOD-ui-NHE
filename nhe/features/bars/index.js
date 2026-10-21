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
    var I = NHE.icons, M = NHE.menuIcons     // M: two-layer, orange fill when active (components/icons.js)
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
    var bSnap = btn('nhe-menus__btn', M.snapshot, '', 'Snapshots').appendTo(acts)
    var bSave = btn('nhe-menus__btn nhe-topbar__save', M.save, '', 'Save').appendTo(acts)
    var bShare = btn('nhe-menus__btn', M.share, '', 'Share').appendTo(acts)
    var chips = $('<div class="nhe-snapchips">').appendTo(top)

    bNew.on('click', function () { closePanel(); mod.menuAction('new') })
    bShare.on('click', function () { closePanel(); mod.menuAction('share') })

    // the drop-down panels under the bar, at the right (Save, Snapshots):
    // two choices with radio buttons, Cancel / Save
    var panel = null, panelFor = null, refreshPanel = null
    var closePanel = function () {
        if (panel) panel.remove()
        panel = panelFor = refreshPanel = null
        top.find('.nhe-menus__btn').removeClass('is-open')
    }
    var openPanel = function (which, button, choices, extra) {
        if (panelFor === which) { closePanel(); return }
        closePanel()
        panelFor = which
        button.addClass('is-open')
        panel = $('<div class="nhe-menupanel" role="dialog">').attr('aria-label', button.attr('title')).appendTo(top)
        var pick = 0
        // a choice with `ask` (Save as) shows a field for the new name under the
        // choices; left empty, it takes the suggestion shown in it
        var field = $('<input type="text" class="nhe-dialog__input nhe-menupanel__field" autocomplete="off" spellcheck="false">')
        var rows = choices.map(function (c, i) {
            var r = $('<button type="button" class="nhe-menupanel__choice">').html('<span class="nhe-menupanel__radio"></span>' + (c.icon || '') + '<span class="nhe-menupanel__label"></span>').appendTo(panel)
            r.find('.nhe-menupanel__label').text(c.label)
            if (c.note) $('<span class="nhe-menupanel__note">').text(c.note).appendTo(r)
            r.on('click', function () { choose(i) })
            return r
        })
        field.appendTo(panel).attr('aria-label', 'Name')
        var choose = function (i) {
            pick = i
            rows.forEach(function (x, j) { x.toggleClass('is-on', j === i) })
            var ask = choices[i].ask
            field.toggle(!!ask)
            if (ask) { field.val('').attr('placeholder', ask()); setTimeout(function () { field[0].focus() }, 0) }
        }
        var save = function () {
            var c = choices[pick], name = c.ask ? $.trim(field.val()) || $.trim(field.attr('placeholder') || '') : null
            if (c.ask && !name) return
            closePanel()
            c.run(name)
        }
        field.on('keydown', function (e) {
            e.stopPropagation()               // MOD listens for keys on the page
            if (e.key === 'Enter') { e.preventDefault(); save() }
            if (e.key === 'Escape') { e.preventDefault(); closePanel() }
        }).on('keyup keypress', function (e) { e.stopPropagation() })
        var foot = $('<div class="nhe-menupanel__buttons">').appendTo(panel)
        foot.append(NHE.textButton('Cancel', 'secondary', closePanel))
        foot.append(NHE.textButton('Save', 'primary', save))
        choose(0)
        if (extra) extra(panel)
    }
    bSave.on('click', function () {
        openPanel('save', bSave, [
            { icon: I.save, label: 'Save', note: mod.boardName(), run: function () { mod.menuAction('save') } },
            { icon: I.saveAs, label: 'Save as', ask: function () { return mod.boardTitle() || 'Pedalboard' }, run: function (name) { mod.saveBoardAs(name) } }
        ])
    })
    bSnap.on('click', function () {
        openPanel('snapshots', bSnap, [
            { icon: I.save, label: 'Save', note: mod.snapshotName(), run: function () { mod.menuAction('snapshotSave') } },
            { icon: I.saveAs, label: 'Save as', ask: function () { return mod.snapshotName() || 'Snapshot' }, run: function (name) { mod.saveSnapshotAs(name) } }
        ], manageSnapshots)
    })
    // under the Save choices (Figma "Frame 93"): the board's snapshots, the
    // current one highlighted; a tap loads one, the pencil renames the
    // current one in place, the bin deletes it (after a yes)
    var manageSnapshots = function (p) {
        $('<div class="nhe-menupanel__heading">').text('Load / manage snapshots').appendTo(p)
        var list = $('<div class="nhe-snaplist" role="listbox">').attr('aria-label', 'Snapshots').appendTo(p)
        var tools = $('<div class="nhe-snaplist__tools">').appendTo(p)
        var bRename = btn('nhe-menus__btn', I.rename, '', 'Rename snapshot').appendTo(tools)
        var bDelete = btn('nhe-menus__btn', I.remove, '', 'Delete snapshot').appendTo(tools)
        var snaps = []
        var refused = function () {
            if (!mod.snapshotsAddressed()) return false
            mod.notify('warn', 'Cannot change snapshots while addressed to hardware', 3000)
            return true
        }
        // renames and deletes send nothing over the websocket: redraw the list and the chips
        var changed = function () {
            if (panelFor === 'snapshots') render()
            if (saved() === 'nhe') renderChips()
        }
        var render = function () {
            mod.snapshots(function (l) {
                snaps = l
                var cur = mod.snapshotCurrent()
                p.find('.nhe-menupanel__note').first().text(mod.snapshotName())     // Save: the current one
                list.empty()
                l.forEach(function (s) {
                    $('<button type="button" class="nhe-snaplist__row" role="option">').text(s.name).attr('aria-selected', s.id === cur)
                        .toggleClass('is-on', s.id === cur).data('id', s.id).appendTo(list)
                        .on('click', function () {
                            if (s.id === mod.snapshotCurrent() || refused()) return
                            mod.loadSnapshot(s.id, function (ok) { if (ok && panelFor === 'snapshots') render() })
                        })
                })
                var has = l.some(function (s) { return s.id === cur })
                bRename.prop('disabled', !has)
                bDelete.prop('disabled', !has || l.length < 2)      // MOD keeps at least one
                var on = list.children('.is-on')[0]
                if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' })
            })
        }
        refreshPanel = function () { if (!list.find('.nhe-snaplist__field').length) render() }   // not mid-rename
        bRename.on('click', function () {
            var row = list.children('.is-on'), id = row.data('id')
            if (!row.length || refused()) return
            var old = row.text(), done = false
            var field = $('<input type="text" class="nhe-snaplist__field" autocomplete="off" spellcheck="false">').val(old).attr('aria-label', 'Snapshot name')
            row.empty().append(field)
            var finish = function (keep) {
                if (done) return
                done = true
                var name = $.trim(field.val())
                if (!keep || !name || name === old) { row.text(old); return }
                row.text(name)
                mod.renameSnapshot(id, name, changed)
            }
            field.on('keydown', function (e) {
                e.stopPropagation()               // MOD listens for keys on the page
                if (e.key === 'Enter') { e.preventDefault(); finish(true) }
                if (e.key === 'Escape') { e.preventDefault(); finish(false) }
            }).on('keyup keypress click', function (e) { e.stopPropagation() })
                .on('blur', function () { finish(true) })
            field[0].focus()
            field[0].select()
        })
        bDelete.on('click', function () {
            var row = list.children('.is-on'), id = row.data('id')
            if (!row.length || snaps.length < 2 || refused()) return
            NHE.ConfirmDialog({
                plugin: row.text(), pill: 'Snapshot',
                title: 'Delete this snapshot?', icon: 'remove',
                onYes: function () { mod.removeSnapshot(id, changed) }
            })
        })
        render()
    }
    // a press anywhere else closes a panel; so does Escape
    $(document).on('pointerdown', function (e) { if (panel && !$(e.target).closest('.nhe-menupanel, .nhe-topbar__actions, .nhe-dialog-overlay').length) closePanel() })
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

    // ---- tempo and sync (components/controls/tempo.js) in place of MOD's window

    var tempoDialog = null
    var transportBindings = function () {
        return { ':bpm': mod.transportBinding(':bpm'), ':bpb': mod.transportBinding(':bpb'), ':rolling': mod.transportBinding(':rolling') }
    }
    var openTempo = function () {
        if (tempoDialog) return
        bTempo.addClass('is-selected')
        tempoDialog = NHE.TempoDialog({
            state: mod.transport(),
            bindings: transportBindings(),
            onSync: function (mode) { mod.setSyncMode(mode) },
            onBpm: function (v) { mod.setTempo(v) },
            onBpb: function (v) { mod.setBeatsPerBar(v) },
            onRolling: function (on) { mod.setRolling(on) },
            // NHE's addressing dialog over MOD's form; bindings shown again when it closes
            onSettings: function (symbol) {
                var a = mod.transportAddressing(symbol)
                if (!a) return
                NHE.AddressingDialog({
                    plugin: a.plugin, control: a.control, model: a.model, minimised: null,
                    onClose: function () { if (tempoDialog) tempoDialog.update(mod.transport(), transportBindings()) }
                })
            },
            onClose: function () { tempoDialog = null; bTempo.removeClass('is-selected') }
        })
    }

    // ---- bottom bar ----------------------------------------------------------

    var bottom = $('<div class="nhe-ctl nhe-menus nhe-bottombar">')
    var nav = $('<div class="nhe-bottombar__nav">').appendTo(bottom)
    var NAV = [
        ['constructor', M.constructor, 'Constructor'], ['library', M.library, 'Library'], ['banks', M.banks, 'Banks'],
        ['files', M.filemanager, 'File manager'], ['store', M.store, 'Store']
    ]
    var navBtns = {}
    NAV.forEach(function (n) {
        navBtns[n[0]] = btn('nhe-menus__btn nhe-bottombar__screen', n[1], n[2], n[2]).appendTo(nav).on('click', function () { mod.menuAction(n[0]) })
    })

    var right = $('<div class="nhe-bottombar__right">').appendTo(bottom)
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

    var bTempo = btn('nhe-menus__btn nhe-menus__btn--label nhe-bottombar__tempo', M.tempo, '120bpm', 'Tempo and sync').appendTo(right).on('click', function () { openTempo() })
    var bPlay = btn('nhe-menus__btn', M.play, '', 'Play').appendTo(right).on('click', function () { mod.setRolling(!mod.rolling()); renderTransport() })
    // MOD's Bypass 1 / 2 (on a device only): orange framed while bypassed
    var bypassBtns = {}
    ;[['bypass1', '1'], ['bypass2', '2']].forEach(function (x) {
        bypassBtns[x[0]] = btn('nhe-menus__btn nhe-menus__btn--label nhe-bottombar__bypass', I.shuffle, x[1], 'Bypass ' + x[1]).appendTo(right)
            .on('click', function () { mod.menuAction(x[0]) })
    })
    var bMenu = btn('nhe-menus__btn nhe-bottombar__more', M.sliders, '', 'More').appendTo(right).on('click', function () { toggleMore() })

    // the rest in a menu over the bar's right end (Figma "Frame 77"): each
    // item when MOD shows it; the device-only ones (MIDI ports, Devices,
    // Settings, Update) never on MOD Desktop
    var DEVICE_ONLY = { midiPorts: 'mod-show-midi-port', devices: 'mod-devices', settings: 'mod-settings', update: 'mod-update' }
    var deviceShows = function (name) { return $(document.getElementById(DEVICE_ONLY[name])).is(':visible') }
    var MORE = [
        { id: 'midiPorts', icon: M.midi, label: 'MIDI ports' },
        { id: 'cv', icon: M.cv, label: 'Manage CV ports' },
        { id: 'tempo', icon: M.tempo, label: 'Global tempo & sync', run: function () { openTempo() } },
        { id: 'performance', icon: I.bolt, label: 'Performance view' },
        { id: 'report', icon: M.report, label: 'Report a problem' },
        { id: 'devices', icon: I.device, label: 'Devices' },
        { id: 'settings', icon: I.cpu, label: 'System settings' },
        { id: 'update', icon: I.checkSquare, label: function (it) { return it.available ? 'Update available' : 'System is up to date' } }
    ]
    var more = null
    var closeMore = function () {
        if (more) more.remove()
        more = null
        bMenu.removeClass('is-open')
    }
    var toggleMore = function () {
        if (more) { closeMore(); return }
        closePanel()
        bMenu.addClass('is-open')
        more = $('<div class="nhe-menupanel nhe-menupanel--up" role="menu">').attr('aria-label', 'More').appendTo(bottom)
        MORE.forEach(function (m) {
            var it = m.id === 'tempo' ? { shown: true } : mod.menuItem(m.id)
            if (!it.shown || (DEVICE_ONLY[m.id] && !deviceShows(m.id))) return
            var r = $('<button type="button" class="nhe-menupanel__item" role="menuitem">').html(m.icon + '<span></span>').appendTo(more)
            r.find('span').text(typeof m.label === 'function' ? m.label(it) : m.label)
            r.toggleClass('is-selected', !!it.selected).toggleClass('is-alert', !!it.available)
            r.on('click', function () {
                closeMore()
                if (m.run) m.run(); else mod.menuAction(m.id)
            })
        })
    }
    $(document).on('pointerdown', function (e) { if (more && !$(e.target).closest('.nhe-menupanel--up, .nhe-bottombar__more').length) closeMore() })
    $(document).on('keydown', function (e) { if (more && e.key === 'Escape') closeMore() })

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
        // Bypass 1 / 2: on a device only (MOD shows them there, never on MOD Desktop)
        ;[['bypass1', 'mod-bypassLeft'], ['bypass2', 'mod-bypassRight']].forEach(function (x) {
            var it = mod.menuItem(x[0])
            bypassBtns[x[0]].toggle(!!it.shown && $(document.getElementById(x[1])).is(':visible')).toggleClass('is-bypassed', !it.on)
        })
        // an update waiting: a dot on the menu button
        bMenu.toggleClass('is-modified', !!mod.menuItem('update').available && deviceShows('update'))
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
        // rolling: the stop square, active (orange); stopped: play
        bPlay.html(on ? M.stop : M.play).attr({ title: on ? 'Stop' : 'Play', 'aria-label': on ? 'Stop' : 'Play' }).toggleClass('is-selected', on)
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
        if (on) { renderMenus(); renderStats(); renderTempo(); renderChips() } else { closePanel(); closeMore() }
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
    mod.onSnapshots(function () {
        if (saved() === 'nhe') renderChips()
        if (refreshPanel) refreshPanel()
    })
    mod.onStats(function (st) { if (saved() === 'nhe') renderStats(st) })
    mod.onTempo(function () {
        if (saved() === 'nhe') renderTempo()
        if (tempoDialog) tempoDialog.update(mod.transport())
    })
    apply()
})
