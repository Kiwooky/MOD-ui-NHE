import asyncio, os
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':1180,'height':820}, has_touch=True, is_mobile=True, device_scale_factor=2)
    pg=await ctx.new_page(); ev=pg.evaluate; errs=[]
    if os.environ.get('FORCE_JS_SNAP'):
        await pg.add_init_script("window.PERFORMANCE_VIEW_FORCE_JS_SNAP=true; document.addEventListener('DOMContentLoaded',function(){var st=document.createElement('style');st.textContent='#performance-view .performance-stage{scroll-snap-type:none !important}';document.head.appendChild(st)})")
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto('http://localhost:8888/'); await pg.wait_for_timeout(2500)
    await ev("desktop.loadPedalboard('/home/claude/modhome/pbs/Perf_Test.pedalboard', function(){})"); await pg.wait_for_timeout(6000)
    await ev("desktop.performanceView.goTo(0)")
    await pg.tap('#mod-performance'); await pg.wait_for_timeout(900)
    cdp=await ctx.new_cdp_session(pg)
    st="[$('.performance-slide.active').attr('data-instance'), Math.round($('.performance-stage')[0].scrollLeft), (function(){var s=$('.performance-stage')[0].getBoundingClientRect(),a=$('.performance-slide.active')[0].getBoundingClientRect();return Math.round(a.left+a.width/2-(s.left+s.width/2))})()]"
    print('start', await ev(st))
    async def swipe(x,y,dx,steps=14):
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        for i in range(1,steps+1):
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x+dx*i/steps,'y':y}]})
            await pg.wait_for_timeout(16)
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    # swipe left starting on the GUITARIX label of the active pedal (not a knob)
    for (x,y,dx,label) in [(590,330,-260,'short swipe on active pedal'),(590,330,-700,'long swipe'),(300,300,500,'swipe back starting on neighbour')]:
        await swipe(x,y,dx)
        await pg.wait_for_timeout(1200)
        print(label, await ev(st))
    # flip the pedal: a swipe on its back scrolls the settings, not the carousel
    before=await ev(st)
    await pg.tap('.performance-slide.active .performance-flip'); await pg.wait_for_timeout(700)
    await swipe(900,500,-400)
    await pg.wait_for_timeout(800)
    print('back swipe', before, await ev(st), await ev("$('.performance-back .nhe-settings:visible .nhe-scroll__area')[0].scrollLeft"))
    await pg.tap('.performance-back .nhe-settings:visible .nhe-system-bar__exit'); await pg.wait_for_timeout(700)
    print('flipped back', not await ev('desktop.performanceView.isFlipped()'))
    # drag a knob on the active pedal: knob turns, carousel stays
    kq="(function(){var a=$('.performance-slide.active'); var k=a.find('[mod-role=input-control-port]').first(); var r=k[0].getBoundingClientRect(); return [k.attr('mod-port-symbol'), a.attr('data-instance'), r.left+r.width/2, r.top+r.height/2]})()"
    sym,inst,kx,ky=await ev(kq)
    await ev("(function(){window._tl=[]; var k=$('.performance-slide.active [mod-role=input-control-port]').first()[0]; ['touchstart','touchmove','touchend','mousedown','mousemove'].forEach(function(t){k.addEventListener(t,function(e){window._tl.push(t)},true)}); document.addEventListener('touchstart',function(e){window._tl.push('doc-ts:'+e.target.className)},true)})()")
    print('hit', await ev("(function(){var e=document.elementFromPoint(%f,%f); return e.className+' / '+e.getAttribute('mod-role')})()"%(kx,ky)))
    v0=await ev("$('#pedalboard-dashboard').data('plugins')['%s'].data('gui').controls['%s'].value"%(inst,sym))
    b0=await ev(st)
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':kx,'y':ky}]})
    for i in range(1,11):
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':kx-15*i,'y':ky-8*i}]}); await pg.wait_for_timeout(16)
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    await pg.wait_for_timeout(800)
    v1=await ev("$('#pedalboard-dashboard').data('plugins')['%s'].data('gui').controls['%s'].value"%(inst,sym))
    print(await ev("window._tl.slice(0,12).join(',')"))
    print('knob drag', sym, v0, '->', v1, b0, await ev(st))
    # tap neighbour
    await pg.touchscreen.tap(900, 330); await pg.wait_for_timeout(1000)
    print('tap right neighbour', await ev(st))
    await pg.screenshot(path='touch.png')
    print('errors', errs)
    await b.close()
asyncio.run(main())
