import asyncio, os
from playwright.async_api import async_playwright
BASE=os.environ.get('BASE','http://localhost:8888/'); PBS=os.environ.get('PBS','/home/claude/modhome/pbs/'); INJECT=os.environ.get('INJECT')
res=[]
def ok(n,c,i=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+('  '+str(i) if i!='' else ''))
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1180,'height':820}, has_touch=True)
    pg=await ctx.new_page(); ev=pg.evaluate; errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)+' '+(e.stack or '')[:300]))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    async def boot(clear):
        await pg.goto(BASE); await pg.wait_for_timeout(2500)
        if INJECT: await pg.add_script_tag(path=INJECT)
        if clear: await ev("localStorage.clear()")
        await ev("desktop.loadPedalboard('"+PBS+"Perf_Test.pedalboard', function(){})"); await pg.wait_for_timeout(6500)
        await pg.click('#mod-performance'); await pg.wait_for_timeout(900)
    await boot(True)
    slides="$('.performance-slide').map(function(){return $(this).attr('data-instance')}).get()"
    act="$('.performance-slide.active').attr('data-instance')"
    ok('hide button visible on a pedal', await ev("$('.performance-hide').is(':visible')"))
    ok('no tile when nothing hidden', await ev("$('.performance-tile').length===0"))
    await ev("desktop.performanceView.goTo(2)"); await pg.wait_for_timeout(900)
    await pg.click('.performance-hide'); await pg.wait_for_timeout(900)
    s=await ev(slides)
    ok('hide removes pedal, next slides in', '/graph/echo' not in s and await ev(act)=='/graph/trem', (s, await ev(act)))
    ok('tile appears with count', await ev("$('.performance-tile b').text()")=='1 hidden' and s[-1]==':hidden')
    ok('hidden icon back on canvas', await ev("$('#pedalboard-dashboard').data('plugins')['/graph/echo'].parent().is('#pedalboard-dashboard')"))
    ok('strip shows new active settings', await ev("$('.performance-strip > .mod-settings').attr('mod-instance')")=='/graph/trem')
    # hide the last pedal -> previous slides in
    await ev("desktop.performanceView.goTo($('.performance-slide').index($('.performance-slide[data-instance=\"/graph/eq\"]')))"); await pg.wait_for_timeout(900)
    await pg.click('.performance-hide'); await pg.wait_for_timeout(900)
    ok('hiding last pedal selects previous', await ev(act)=='/graph/verb', await ev(act))
    ok('tile count 2', await ev("$('.performance-tile b').text()")=='2 hidden')
    # inbound update to a hidden pedal is harmless
    sym=await ev("Object.keys($('#pedalboard-dashboard').data('plugins')['/graph/echo'].data('gui').controls).filter(function(k){return k[0]!=':'})[0]")
    await ev("ws.onmessage({data: 'param_set /graph/echo %s 50'})"%sym); await pg.wait_for_timeout(200)
    ok('update to hidden pedal reaches its GUI', await ev("$('#pedalboard-dashboard').data('plugins')['/graph/echo'].data('gui').controls['%s'].value"%sym)==50)
    # tap the tile (neighbour) -> shelf
    await ev("$('.performance-tile')[0].scrollIntoView()"); 
    box=await ev("JSON.stringify($('.performance-tile')[0].getBoundingClientRect())")
    import json; bx=json.loads(box)
    await pg.mouse.click(min(bx['x']+bx['width']/2, 1170), bx['y']+bx['height']/2); await pg.wait_for_timeout(1000)
    ok('tile becomes active', await ev(act)==':hidden', await ev(act))
    ok('shelf shows hidden pedals in signal order', await ev("$('.performance-shelf-item .performance-shelf-label').map(function(){return $(this).text()}).get()"), await ev("$('.performance-shelf-item .performance-shelf-label').map(function(){return $(this).text()}).get()"))
    ok('shelf has show all, hide button hidden, no settings', await ev("$('.performance-show-all').is(':visible') && !$('.performance-hide').is(':visible') && $('.performance-strip > .mod-settings').length===0"))
    await pg.screenshot(path='h_shelf.png')
    # restore echo from shelf
    await pg.click('.performance-shelf-item >> nth=0'); await pg.wait_for_timeout(1000)
    ok('restored pedal back in place and active', (await ev(slides))[2]=='/graph/echo' and await ev(act)=='/graph/echo', (await ev(slides), await ev(act)))
    ok('tile count 1', await ev("$('.performance-tile b').text()")=='1 hidden')
    # persistence across reload
    await boot(False)
    s=await ev(slides)
    ok('hidden survives reload', '/graph/eq' not in s and s[-1]==':hidden' and await ev(act)!=':hidden', (s, await ev(act)))
    # other board unaffected
    await ev("desktop.loadPedalboard('"+PBS+"Perf_Test_B.pedalboard', function(){})"); await pg.wait_for_timeout(6500)
    ok('other pedalboard unaffected', await ev("$('.performance-tile').length===0 || !$('.performance-tile').is(':visible') || $('.performance-slide[data-instance=\":hidden\"]').parent().length===0"), await ev(slides))
    await ev("desktop.loadPedalboard('"+PBS+"Perf_Test.pedalboard', function(){})"); await pg.wait_for_timeout(6500)
    # hide everything
    for i in range(6):
        await ev("desktop.performanceView.goTo(0)"); await pg.wait_for_timeout(500)
        if await ev(act)==':hidden': break
        await pg.click('.performance-hide'); await pg.wait_for_timeout(600)
    ok('all hidden: only tile, shelf visible', await ev(slides)==[':hidden'] and await ev("$('.performance-shelf').is(':visible')"), await ev(slides))
    await pg.screenshot(path='h_all.png')
    await pg.click('.performance-show-all'); await pg.wait_for_timeout(1000)
    s=await ev(slides)
    ok('show all restores everything', len(s)==6 and ':hidden' not in s and await ev(act)==s[0], (s, await ev(act)))
    # hide one, exit: every icon back on canvas
    await pg.click('.performance-hide'); await pg.wait_for_timeout(600)
    await pg.click('#mod-plugins'); await pg.wait_for_timeout(600)
    ok('exit: all icons on canvas', await ev("Object.values($('#pedalboard-dashboard').data('plugins')).every(function(i){return i.parent().is('#pedalboard-dashboard')})"))
    await ev("localStorage.clear()")
    ok('no page errors', not errs, errs[:2])
    await b.close()
asyncio.run(main())
print('%d/%d'%(sum(map(bool,res)),len(res)))
