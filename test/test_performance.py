import asyncio, json, sys, os
BASE=os.environ.get('BASE','http://localhost:8888/'); PBS=os.environ.get('PBS','/home/claude/modhome/pbs/'); INJECT=os.environ.get('INJECT')
from playwright.async_api import async_playwright
W,H=1180,820
res=[]
def ok(name, cond, info=''):
    res.append((name, bool(cond), info)); print(('PASS ' if cond else 'FAIL ')+name+('  '+str(info) if info else ''))
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    pg=await b.new_page(viewport={'width':W,'height':H}, has_touch=True)
    if os.environ.get('FORCE_JS_SNAP'):
        await pg.add_init_script("window.PERFORMANCE_VIEW_FORCE_JS_SNAP=true; document.addEventListener('DOMContentLoaded',function(){var st=document.createElement('style');st.textContent='#performance-view .performance-stage{scroll-snap-type:none !important}';document.head.appendChild(st)})")
    errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)+' '+(e.stack or '')[:300]))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    PVLOGS=[]
    if os.environ.get('DEBUG_PV'):
        await pg.add_init_script('window.PERFORMANCE_VIEW_DEBUG=true')
        pg.on('console', lambda m: PVLOGS.append(m.text) if '[performance]' in m.text else None)
    ev=pg.evaluate
    await pg.goto(BASE); await pg.wait_for_timeout(2500)
    if INJECT: await pg.add_script_tag(path=INJECT); await pg.wait_for_timeout(300)
    await ev("desktop.loadPedalboard('"+PBS+"Perf_Test.pedalboard', function(){})")
    await pg.wait_for_timeout(6000)
    before=await ev("[$('#pedalboard-dashboard').data('scale'), $('#pedalboard-dashboard').attr('style'), Object.values($('#pedalboard-dashboard').data('plugins')).map(function(i){return i.attr('style')}).join('|')]")
    # AC1/3 enter
    await pg.click('#mod-performance'); await pg.wait_for_timeout(800)
    ok('AC1 bolt opens view', await ev("$('#performance-view').is(':visible')"))
    ok('AC3 bolt selected, puzzle not', await ev("$('#mod-performance').hasClass('selected') && !$('#mod-plugins').hasClass('selected')"))
    # AC5 no jacks visible
    ok('AC5 no visible jacks/actions', await ev("$('#performance-view [mod-role$=-audio-port]:visible, #performance-view .mod-actions:visible').length===0"))
    # AC6 order
    order=await ev("$('.performance-slide').map(function(){return $(this).attr('data-instance')}).get()")
    ok('AC6 signal order', order==['/graph/comp','/graph/phaser','/graph/echo','/graph/trem','/graph/verb','/graph/eq'], order)
    # AC4 scale cap
    sc=await ev("desktop.performanceView && $('.performance-scaler').map(function(){return parseFloat(this.style.transform.replace('scale(',''))}).get()")
    ok('AC4 scale <= 2', max(sc)<=2.0001, sc)
    async def centred():
        return await ev("""(function(){var st=$('.performance-stage')[0], a=$('.performance-slide.active')[0]; if(!a) return 999; var r=a.getBoundingClientRect(), s=st.getBoundingClientRect(); return Math.round((r.left+r.width/2)-(s.left+s.width/2))})()""")
    async def act(): return await ev("$('.performance-slide.active').attr('data-instance')")
    ok('AC9 one active ring', await ev("$('.performance-slide.active').length===1"))
    # AC8 snap after trackpad-like horizontal wheel
    await pg.mouse.move(W/2, 300)
    for dx in [120,90,60]:
        await pg.mouse.wheel(dx,0); await pg.wait_for_timeout(60)
    await pg.wait_for_timeout(1200)
    c=await centred(); ok('AC8 snaps centred after horizontal scroll', abs(c)<=2, (c, await act()))
    # vertical wheel steps one pedal
    a0=await act(); await pg.mouse.wheel(0,100); await pg.wait_for_timeout(1000)
    a1=await act(); c=await centred(); ok('AC8 vertical wheel = one pedal, centred', a0!=a1 and abs(c)<=2, (a0,a1,c))
    # AC12 arrows
    await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(900)
    ok('AC12 ArrowLeft goes back', await act()==a0, await act())
    await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(900)
    ok('AC12 ArrowRight goes forward', await act()==a1, await act())
    # AC11 tap neighbour selects it without changing its controls
    nb=await ev("$('.performance-slide.active').next('.performance-slide').attr('data-instance')")
    vals_before=await ev("JSON.stringify(Object.fromEntries(Object.entries($('#pedalboard-dashboard').data('plugins')['"+nb+"'].data('gui').controls).map(function(e){return [e[0],e[1].value]})))")
    box=await ev("JSON.stringify($('.performance-slide[data-instance=\""+nb+"\"] [mod-role=input-control-port]')[0].getBoundingClientRect())")
    bx=json.loads(box)
    # first try to drag the neighbour's knob (must do nothing), then tap it
    await pg.mouse.move(bx['x']+bx['width']/2, bx['y']+bx['height']/2); await pg.mouse.down(); await pg.mouse.move(bx['x']+bx['width']/2, bx['y']-60, steps=6); await pg.mouse.up()
    await pg.wait_for_timeout(300)
    await pg.mouse.click(bx['x']+bx['width']/2, bx['y']+bx['height']/2)
    await pg.wait_for_timeout(900)
    vals_after=await ev("JSON.stringify(Object.fromEntries(Object.entries($('#pedalboard-dashboard').data('plugins')['"+nb+"'].data('gui').controls).map(function(e){return [e[0],e[1].value]})))")
    ok('AC11 click neighbour selects it', await act()==nb, (nb, await act()))
    ok('AC11 neighbour knob untouched', vals_before==vals_after)
    c=await centred(); ok('AC8 centred after tap', abs(c)<=2, c)
    # AC15 strip shows active settings
    ok('AC15 strip shows active pedal settings', await ev("$('.performance-strip > .mod-settings').attr('mod-instance')")==nb)
    # AC16 centred when fits, scrollable from the left when not
    q="""(function(){var g=$('.performance-strip .mod-control-group')[0], c=$('.performance-strip .mod-controls')[0]; var gr=g.getBoundingClientRect(), cr=c.getBoundingClientRect(); return [Math.round(gr.left-cr.left), Math.round(cr.right-gr.right), c.scrollWidth>c.clientWidth]})()"""
    for inst in ['/graph/phaser','/graph/comp']:
        await ev("desktop.performanceView.goTo($('.performance-slide').index($('.performance-slide[data-instance=\""+inst+"\"]')))"); await pg.wait_for_timeout(900)
        cen=await ev(q)
        if cen[2]: ok('AC16 %s overflows: starts at left, scrolls'%inst, cen[0]==0, cen)
        else: ok('AC16 %s fits: centred'%inst, abs(cen[0]-cen[1])<=2, cen)
    # strip scroll must not move the carousel (AC17): use the pedal with the most controls
    await ev("desktop.performanceView.goTo($('.performance-slide').index($('.performance-slide[data-instance=\"/graph/eq\"]')))"); await pg.wait_for_timeout(900)
    cen=await ev(q); ok('AC16 /graph/eq overflows: starts at left, scrolls', cen[2] and cen[0]==0, cen)
    sl=await ev("$('.performance-stage')[0].scrollLeft")
    await ev("$('.performance-strip .mod-controls')[0].scrollLeft=200")
    await pg.mouse.move(600, 700); await pg.mouse.wheel(150,0); await pg.wait_for_timeout(500)
    ok('AC17 strip scroll leaves carousel alone', await ev("$('.performance-stage')[0].scrollLeft")==sl and await ev("$('.performance-strip .mod-controls')[0].scrollLeft")>0)
    await ev("desktop.performanceView.goTo($('.performance-slide').index($('.performance-slide[data-instance=\"/graph/trem\"]')))"); await pg.wait_for_timeout(900)
    # AC18 knob turned on the pedal face updates strip + editor gui
    box=json.loads(await ev("JSON.stringify($('.performance-slide.active [mod-role=input-control-port][mod-port-symbol=depth]')[0].getBoundingClientRect())"))
    await pg.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); await pg.mouse.down()
    await pg.mouse.move(box['x']+box['width']/2, box['y']-80, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(400)
    v=await ev("$('#pedalboard-dashboard').data('plugins')['/graph/trem'].data('gui').controls.depth.value")
    strip=await ev("$('.performance-strip [mod-role=input-control-value][mod-port-symbol=depth]').text()")
    ok('AC18 face knob -> strip value', strip and abs(float(strip.split()[0])-v)<0.01, (v,strip))
    # AC19 external change (what host.js does on param_set)
    sym,mid=await ev("(function(){var c=$('#pedalboard-dashboard').data('plugins')['/graph/trem'].data('gui').controls; var k=Object.keys(c).filter(function(x){return x[0]!=':' && x!='depth'})[0]; var r=c[k].ranges; return [k, r.minimum+(r.maximum-r.minimum)*0.37]})()")
    await ev("ws.onmessage({data: 'param_set /graph/trem %s %f'})"%(sym,mid))
    await pg.wait_for_timeout(200)
    strip=await ev("$('.performance-strip [mod-role=input-control-value][mod-port-symbol=%s]').text()"%sym)
    ok('AC19 external param_set reaches strip', strip and abs(float(strip.split()[0])-mid)<0.05*max(1,abs(mid)), (sym, mid, strip))
    # AC20 bypass from host, both directions
    q="[$('.performance-slide.active [mod-role=bypass-light]').attr('class'), $('.performance-strip [mod-role=bypass-light]').attr('class')]"
    b0=await ev(q)
    await ev("ws.onmessage({data: 'param_set /graph/trem :bypass 1'})"); await pg.wait_for_timeout(200)
    b1=await ev(q)
    await ev("ws.onmessage({data: 'param_set /graph/trem :bypass 0'})"); await pg.wait_for_timeout(200)
    b2=await ev(q)
    ok('AC20 external bypass reaches face+strip', b0==b2 and b1!=b0 and b1[0]==b1[1], (b0,b1,b2))
    # and the strip's on/off switch flips the face LED
    await ev("$('.performance-strip [mod-role=bypass]').click()"); await pg.wait_for_timeout(200)
    b3=await ev(q)
    await ev("$('.performance-strip [mod-role=bypass]').click()"); await pg.wait_for_timeout(200)
    ok('AC20 strip on/off -> face LED', b3!=b0 and b3[0]==b3[1], (b0,b3))
    await pg.screenshot(path='t_trem.png')
    # AC13 resize / rotate
    a=await act()
    await pg.set_viewport_size({'width':820,'height':1180}); await pg.wait_for_timeout(1200)
    c=await centred(); ok('AC13 portrait keeps active + centred', await act()==a and abs(c)<=2, (await act(), c))
    await pg.screenshot(path='t_portrait.png')
    await pg.set_viewport_size({'width':W,'height':H}); await pg.wait_for_timeout(1200)
    # AC2 exit via puzzle
    await pg.click('#mod-plugins'); await pg.wait_for_timeout(800)
    ok('AC2 puzzle exits', not await ev("$('#performance-view').is(':visible')"))
    after=await ev("[$('#pedalboard-dashboard').data('scale'), $('#pedalboard-dashboard').attr('style'), Object.values($('#pedalboard-dashboard').data('plugins')).map(function(i){return i.attr('style')}).join('|')]")
    ok('AC2 editor zoom/pan + pedal positions unchanged', before==after, '' if before==after else (before,after))
    ok('AC2 icons back on canvas', await ev("Object.values($('#pedalboard-dashboard').data('plugins')).every(function(i){return i.parent().is('#pedalboard-dashboard')})"))
    ok('AC2 settings back in body + hidden', await ev("Object.values($('#pedalboard-dashboard').data('plugins')).every(function(i){var s=i.data('settings');return s.parent().is('body') && !s.is(':visible')})"))
    ok('AC2 draggable re-enabled', await ev("Object.values($('#pedalboard-dashboard').data('plugins')).every(function(i){return !i.draggable('option','disabled')})"))
    await pg.screenshot(path='t_editor_after.png')
    # AC14 re-enter returns to last pedal
    await pg.click('#mod-performance'); await pg.wait_for_timeout(900)
    ok('AC14 re-enter on last pedal', await act()==a, await act())
    # AC14 other pedalboard -> first pedal ; AC7 empty board
    PVLOGS.clear()
    await ev("desktop.loadPedalboard('"+PBS+"Perf_Test_B.pedalboard', function(){})")
    await pg.wait_for_timeout(7000)
    first=await ev("$('.performance-slide').first().attr('data-instance')")
    if os.environ.get('DEBUG_PV') and await act()!=first:
        print('\n'.join(l[:260] for l in PVLOGS))
    ok('AC14 new pedalboard starts at first pedal', await act()==first and first is not None, (await act(), first))
    # same instance name on another board must not carry over
    await ev("desktop.performanceView.goTo(0)"); await pg.wait_for_timeout(300)
    await ev("desktop.loadPedalboard('"+PBS+"Perf_Test.pedalboard', function(){})"); await pg.wait_for_timeout(7000)
    await ev("desktop.performanceView.goTo(0)"); await pg.wait_for_timeout(900)
    a_before=await act()
    await ev("desktop.loadPedalboard('"+PBS+"Perf_Test_C.pedalboard', function(){})"); await pg.wait_for_timeout(7000)
    ok('AC14 shared instance name does not carry over', a_before=='/graph/comp' and await act()=='/graph/phaser', (a_before, await act()))
    # reloading the same board keeps your place
    await ev("desktop.performanceView.goTo(1)"); await pg.wait_for_timeout(900)
    await ev("desktop.loadPedalboard('"+PBS+"Perf_Test_C.pedalboard', function(){})"); await pg.wait_for_timeout(7000)
    ok('AC14 reloading same board keeps place', await act()=='/graph/comp', await act())
    await ev("desktop.loadPedalboard('"+PBS+"Perf_Empty.pedalboard', function(){})")
    await pg.wait_for_timeout(5000)
    ok('AC7 empty message', await ev("$('.performance-empty').is(':visible') && $('.performance-slide').length===0"))
    await pg.screenshot(path='t_empty.png')
    ok('no page errors', not errs, errs[:3])
    await b.close()
asyncio.run(main())
print('\n%d/%d passed'%(sum(r[1] for r in res), len(res)))
