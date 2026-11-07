#!/usr/bin/env python3
"""Screenshot every page of the new UI (Session 13) for a visual check: /tmp/ui_*.png."""
import asyncio, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / 'dist' / 'realms.html'


async def main():
    from playwright.async_api import async_playwright
    chrome = os.environ.get('CHROME') or ('/usr/bin/google-chrome' if Path('/usr/bin/google-chrome').exists() else None)
    async with async_playwright() as p:
        launch = {'args': ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']}
        if chrome: launch['executable_path'] = chrome
        b = await p.chromium.launch(**launch)
        pg = await b.new_page(viewport={'width': 1500, 'height': 950})
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(HTML.as_uri()); await pg.wait_for_timeout(2500)
        await pg.fill('#run-years', '3'); await pg.click('#run-years-btn'); await pg.wait_for_timeout(4000)
        await pg.mouse.move(1200, 500); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/ui_map.png')
        await pg.hover('.tile[data-tab=food]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/ui_tile_tip.png')
        await pg.click('#menu-btn'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/ui_menu.png')
        await pg.keyboard.press('Escape')
        # realm
        await pg.keyboard.press('k'); await pg.wait_for_timeout(400)
        for tab in ['overview', 'clusters', 'people', 'food', 'treasury', 'stockpile']:
            await pg.click(f'.m-tabs button[data-tab={tab}]'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'/tmp/ui_realm_{tab}.png')
        # cluster: first in the clusters tab
        await pg.click('.m-tabs button[data-tab=clusters]'); await pg.wait_for_timeout(200)
        await pg.click('.m-body a[data-cluster]'); await pg.wait_for_timeout(400)
        for tab in ['overview', 'members', 'food', 'stockpile']:
            await pg.click(f'.m-tabs button[data-tab={tab}]'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'/tmp/ui_cluster_{tab}.png')
        # settlement: the cluster root
        await pg.click('.m-tabs button[data-tab=members]'); await pg.wait_for_timeout(200)
        await pg.click('.m-body a[data-focus]'); await pg.wait_for_timeout(500)
        for tab in ['overview', 'people', 'land', 'economy', 'buildings', 'recruitment']:
            await pg.click(f'.m-tabs button[data-tab={tab}]'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'/tmp/ui_settlement_{tab}.png')
        # Phase 2: the raise dialog and the unit card
        if await pg.query_selector('#modal .cube.avail[data-raise=settlers]'):
            await pg.click('#modal .cube.avail[data-raise=settlers]'); await pg.wait_for_timeout(400)
            await pg.screenshot(path='/tmp/ui_raise_dialog.png')
            await pg.click('#dialog [data-act=raise]'); await pg.wait_for_timeout(500)
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(600)
            await pg.screenshot(path='/tmp/ui_unit_card.png')
            await pg.click('#unitcard [data-act=move]'); await pg.wait_for_timeout(200)
            await pg.mouse.move(820, 520); await pg.wait_for_timeout(300)
            await pg.screenshot(path='/tmp/ui_unit_move.png')
            await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            await pg.keyboard.press('k'); await pg.wait_for_timeout(300)
            await pg.click('.m-tabs button[data-tab=clusters]'); await pg.wait_for_timeout(200)
            await pg.click('.m-body a[data-cluster]'); await pg.wait_for_timeout(300)
            await pg.click('.m-tabs button[data-tab=members]'); await pg.wait_for_timeout(200)
            await pg.click('.m-body a[data-focus]'); await pg.wait_for_timeout(400)
        # a village
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('k'); await pg.wait_for_timeout(300)
        await pg.click('.m-tabs button[data-tab=clusters]'); await pg.wait_for_timeout(200)
        links = await pg.query_selector_all('.m-body a[data-cluster]')
        await links[-1].click(); await pg.wait_for_timeout(300)
        await pg.click('.m-body a[data-focus]'); await pg.wait_for_timeout(400)
        for tab in ['overview', 'people', 'land', 'economy']:
            await pg.click(f'.m-tabs button[data-tab={tab}]'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'/tmp/ui_village_{tab}.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('e'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/ui_editor.png')
        await pg.keyboard.press('e')
        await pg.keyboard.press('?'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/ui_help.png')
        await pg.keyboard.press('Escape')
        await pg.click('#menu-btn'); await pg.click('#menu-settings'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/ui_settings.png')
        print('errors:', errs)
        await b.close()

asyncio.run(main())
