#!/usr/bin/env python3
"""Smoke test of the built game (npm run smoke).

Loads dist/realms.html in headless Chrome, runs a few years, opens the realm,
cluster and settlement panels, buys the first affordable building, advances
until it finishes, sends materials from the realm stockpile — and fails on any
console error or page error. Screenshots go to /tmp/smoke_*.png.

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

        async def panel(): return await pg.inner_text('#settlement')
        def lines(txt, *keys): return [l for l in txt.split('\n') if any(k in l for k in keys)]

        await pg.fill('#run-years', str(YEARS)); await pg.click('#run-years-btn'); await pg.wait_for_timeout(1500 * YEARS)
        await pg.keyboard.press('k'); await pg.wait_for_timeout(400)
        t = await panel(); print('REALM:', *lines(t, 'People', 'Treasury', 'stockpile'), sep='\n  ')
        await pg.screenshot(path='/tmp/smoke_realm.png')
        await pg.click('#settlement a[data-cluster]'); await pg.wait_for_timeout(400)
        t = await panel(); print('CLUSTER:', *lines(t, 'Stockpile', 'Tax'), sep='\n  ')
        await pg.screenshot(path='/tmp/smoke_cluster.png')
        await pg.click('#settlement .members a[data-focus]'); await pg.wait_for_timeout(500)
        t = await panel(); print('SETTLEMENT:', *lines(t, 'Hands', 'Tax base', 'Materials'), sep='\n  ')
        ok = await pg.eval_on_selector_all('#sp-build option', 'os => os.filter(o => !o.classList.contains("dim")).map(o => o.value)')
        print('buildable:', ok)
        if ok:
            await pg.select_option('#sp-build', ok[0]); await pg.wait_for_timeout(200)
            await pg.click('#sp-build-go'); await pg.wait_for_timeout(400)
            t = await panel(); assert '⚒' in t, 'project did not start'
            for _ in range(40):
                await pg.keyboard.press('Space'); await pg.wait_for_timeout(250)
                if '⚒' not in await panel(): break
            t = await panel(); print('BUILT:', *lines(t, 'Buildings'), sep='\n  ')
            await pg.screenshot(path='/tmp/smoke_settlement.png')
        await pg.keyboard.press('k'); await pg.wait_for_timeout(400)
        await pg.fill('#sp-send-timber', '30'); await pg.click('#sp-send-go'); await pg.wait_for_timeout(300)
        t = await panel(); print('REALM AFTER:', *lines(t, 'Treasury', 'stockpile'), sep='\n  ')
        await b.close()
    if errs:
        print('CONSOLE ERRORS:', *errs, sep='\n  '); return 1
    print('smoke OK — zero console errors'); return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
