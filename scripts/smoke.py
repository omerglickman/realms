#!/usr/bin/env python3
"""Smoke test of the built game (npm run smoke).

Loads dist/realms.html in headless Chrome, runs a few years, opens the realm,
cluster and settlement ledgers (Session 13 modals), buys the first affordable
building, advances until it finishes, sends materials from the realm stockpile,
raises a party of settlers (Phase 2: the Recruitment page and the raise dialog),
lets it form, opens its card, disbands it, and sends food inside a cluster — and
fails on any console error or page error. Screenshots go to /tmp/smoke_*.png.

Needs: python3 with the playwright package (pip install playwright) and a
Chrome/Chromium binary — $CHROME, else /usr/bin/google-chrome, else
Playwright's own chromium if `playwright install chromium` worked.
"""
import asyncio, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / 'dist' / 'realms.html'
YEARS = int(os.environ.get('SMOKE_YEARS', '3'))


async def main() -> int:
    from playwright.async_api import async_playwright
    if not HTML.exists():
        print(f'missing {HTML} — run npm run build first'); return 2
    chrome = os.environ.get('CHROME') or ('/usr/bin/google-chrome' if Path('/usr/bin/google-chrome').exists() else None)
    async with async_playwright() as p:
        launch = {'args': ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']}
        if chrome: launch['executable_path'] = chrome
        b = await p.chromium.launch(**launch)
        pg = await b.new_page(viewport={'width': 1500, 'height': 950})
        errs: list[str] = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(HTML.as_uri()); await pg.wait_for_timeout(2500)

        async def panel(): return await pg.inner_text('#modal')
        def lines(txt, *keys): return [l for l in txt.split('\n') if any(k in l for k in keys)]
        async def tab(name): await pg.click(f'.m-tabs button[data-tab={name}]'); await pg.wait_for_timeout(300)

        await pg.fill('#run-years', str(YEARS)); await pg.click('#run-years-btn'); await pg.wait_for_timeout(1500 * YEARS)
        strip = await pg.inner_text('#topbar'); print('STRIP:', strip.replace('\n', ' | ')[:300])
        await pg.keyboard.press('k'); await pg.wait_for_timeout(400)
        t = await panel(); print('REALM:', *lines(t, 'People', 'Treasury', 'grown'), sep='\n  ')
        await pg.screenshot(path='/tmp/smoke_realm.png')
        await tab('clusters')
        await pg.click('#modal .m-body a[data-cluster]'); await pg.wait_for_timeout(400)
        t = await panel(); print('CLUSTER:', *lines(t, 'cluster', 'Stockpile'), sep='\n  ')
        await tab('stockpile'); await pg.screenshot(path='/tmp/smoke_cluster.png')
        await tab('members')
        await pg.click('#modal .m-body a[data-focus]'); await pg.wait_for_timeout(500)
        t = await panel(); print('SETTLEMENT:', *lines(t, 'hands', 'coins'), sep='\n  ')
        await tab('buildings')
        ok = await pg.eval_on_selector_all('#modal .cube.avail', 'bs => bs.map(b => b.dataset.build)')
        print('buildable:', ok)
        if ok:
            await pg.click(f'#modal .cube.avail[data-build={ok[0]}]'); await pg.wait_for_timeout(400)
            assert await pg.query_selector('#modal .cube.project'), 'project did not start'
            for _ in range(40):
                await pg.keyboard.press('Space'); await pg.wait_for_timeout(250)
                if not await pg.query_selector('#modal .cube.project'): break
            t = await panel(); print('BUILT:', *lines(t, 'standing'), sep='\n  ')
            await pg.screenshot(path='/tmp/smoke_settlement.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('k'); await pg.wait_for_timeout(400)
        await tab('stockpile')
        await pg.fill('#sp-send-timber', '30'); await pg.click('#sp-send-go'); await pg.wait_for_timeout(300)
        t = await panel(); print('REALM AFTER:', *lines(t, 'timber'), sep='\n  ')
        # ---- Phase 2: raise settlers at the cluster root, let them form, open the card, disband ----
        await tab('clusters'); await pg.click('#modal .m-body a[data-cluster]'); await pg.wait_for_timeout(300)
        await tab('members'); await pg.click('#modal .m-body a[data-focus]'); await pg.wait_for_timeout(400)
        await tab('recruitment')
        t = await panel(); print('RECRUIT:', *lines(t, 'can be raised'), sep='\n  ')
        if await pg.query_selector('#modal .cube.avail[data-raise=settlers]'):
            await pg.click('#modal .cube.avail[data-raise=settlers]'); await pg.wait_for_timeout(400)
            assert await pg.is_visible('#dialog'), 'raise dialog did not open'
            print('DIALOG:', (await pg.inner_text('#dialog .rd-foot')).replace('\n', ' | '))
            await pg.click('#dialog [data-act=raise]'); await pg.wait_for_timeout(500)
            assert await pg.is_visible('#unitcard'), 'unit card did not open after raising'
            print('CARD:', (await pg.inner_text('#unitcard')).replace('\n', ' | ')[:200])
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(600)  # the party forms
            assert await pg.query_selector('#unitcard [data-act=move]'), 'the formed party has no orders'
            await pg.screenshot(path='/tmp/smoke_unit.png')
            await pg.click('#unitcard [data-act=disband]'); await pg.wait_for_timeout(400)
            assert await pg.is_hidden('#unitcard'), 'the party did not disband on its own settlement'
            print('EVENT:', await pg.inner_text('#info-event'))
        # ---- Phase 2 session 2: a work-band builds a dirt road on its hex ----
        await pg.keyboard.press('Escape'); await pg.keyboard.press('k'); await pg.wait_for_timeout(300)
        await tab('clusters'); await pg.click('#modal .m-body a[data-cluster]'); await pg.wait_for_timeout(300)
        await tab('members'); await pg.click('#modal .m-body a[data-focus]'); await pg.wait_for_timeout(400)
        await tab('recruitment')
        if await pg.query_selector('#modal .cube.avail[data-raise=workband]'):
            await pg.click('#modal .cube.avail[data-raise=workband]'); await pg.wait_for_timeout(400)
            await pg.click('#dialog [data-act=raise]'); await pg.wait_for_timeout(500)
            assert await pg.is_visible('#unitcard'), 'unit card did not open for the work-band'
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(600)  # the band forms
            assert await pg.query_selector('#unitcard [data-act=roadTo]'), 'the work-band card has no Road to…'
            print('BAND CARD:', (await pg.inner_text('#unitcard')).replace('\n', ' | ')[:220])
            ok = False
            for dx, dy in [(70, 10), (-70, 10), (10, 70), (10, -70), (110, 40), (-110, -40)]:
                await pg.click('#unitcard [data-act=roadTo]'); await pg.wait_for_timeout(200)
                assert 'Click the hex' in await pg.inner_text('#info-event'), 'Road to… did not start targeting'
                await pg.mouse.move(750 + dx, 475 + dy); await pg.wait_for_timeout(250)
                await pg.mouse.click(750 + dx, 475 + dy); await pg.wait_for_timeout(300)
                if 'Building' in await pg.inner_text('#unitcard'): ok = True; break
                print('ROAD TARGET REFUSED:', await pg.inner_text('#info-event'))
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
                if await pg.is_hidden('#unitcard'): break
            assert ok, 'the band did not take a road order'
            print('BAND ORDER:', (await pg.inner_text('#unitcard')).replace('\n', ' | ')[:260])
            for _ in range(6):
                await pg.keyboard.press('Space'); await pg.wait_for_timeout(500)
            print('BAND AFTER:', (await pg.inner_text('#unitcard')).replace('\n', ' | ')[:260])
            await pg.screenshot(path='/tmp/smoke_band.png')
        # ---- tier upgrade (Session 15b): a village of the big cluster, if it is at the gate ----
        await pg.keyboard.press('Escape'); await pg.keyboard.press('k'); await pg.wait_for_timeout(300)
        await tab('clusters'); await pg.click('#modal .m-body a[data-cluster]'); await pg.wait_for_timeout(300)
        await tab('members')
        links = await pg.query_selector_all('#modal .m-body a[data-focus]')
        await links[-1].click(); await pg.wait_for_timeout(400)
        await tab('overview')
        t = await panel(); print('UPGRADE CARD:', *lines(t, 'Become a', 'Rising to', 'needs', 'short of'), sep='\n  ')
        if await pg.query_selector('#modal [data-upgrade]'):
            await pg.click('#modal [data-upgrade]'); await pg.wait_for_timeout(300)
            assert await pg.query_selector('#modal [data-cancel-upgrade]'), 'upgrade did not start'
            print('UPGRADE:', await pg.inner_text('#info-event'))
        await tab('land'); await pg.screenshot(path='/tmp/smoke_land.png')
        # ---- send food between two members of a cluster ----
        await pg.keyboard.press('Escape'); await pg.keyboard.press('k'); await pg.wait_for_timeout(300)
        await tab('clusters'); await pg.click('#modal .m-body a[data-cluster]'); await pg.wait_for_timeout(300)
        await tab('food')
        if await pg.query_selector('#sf-go'):
            await pg.fill('#sf-amount', '300'); await pg.click('#sf-go'); await pg.wait_for_timeout(300)
            ev = await pg.inner_text('#info-event'); print('SEND FOOD:', ev)
            assert 'sent 300 food' in ev, 'send food did not happen'
        # ---- a castle placed by command (Session 18): its ledger, a month of service, its hover card ----
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        cid = await pg.evaluate('''() => {
          const w = window.__realms, st = w.state();
          const ss = Object.values(st.settlements).filter(s => s.tier === 0);
          for (const v of ss) for (const [dc, dr] of [[2,0],[-2,0],[0,2],[0,-2],[3,1],[-3,-1]]) {
            const n = Object.keys(w.state().settlements).length;
            w.act({ type: 'foundSettlement', settlement: { name: 'Smoke Keep', tier: 4, col: v.col + dc, row: v.row + dr, population: 0 } });
            if (Object.keys(w.state().settlements).length > n) { const id = Object.values(w.state().settlements).find(x => x.name === 'Smoke Keep').id; w.focus(id); return id; }
          }
          return null; }''')
        assert cid, 'could not place a castle'
        await pg.wait_for_timeout(400)
        for _ in range(3):
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(400)
        ct = await panel(); print('CASTLE:', *lines(ct, 'Smoke Keep', 'staff', 'Garrison', 'Hands', 'reserve', 'upkeep'), sep='\n  ')
        print(ct[:400].replace(chr(10),' | ')); assert 'castle' in ct.lower(), 'castle modal did not open'
        await pg.screenshot(path='/tmp/smoke_castle.png')
        await pg.keyboard.press('Escape'); await pg.keyboard.press('k'); await pg.wait_for_timeout(300)
        await tab('treasury'); print('LEDGER:', *lines(await panel(), 'castles'), sep='\n  ')
        await b.close()
    if errs:
        print('CONSOLE ERRORS:', *errs, sep='\n  '); return 1
    print('smoke OK — zero console errors'); return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
