from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path('/mnt/data/Kovok_Construction_UI_Premium')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000}, device_scale_factor=1)
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content((root/'index.html').read_text(), wait_until='load')
    page.wait_for_timeout(200)
    print('title:', page.title())
    for key in ['overview','requests','quotations','orders','exceptions','catalog','suppliers','integrations','settings']:
        page.locator(f'.nav-btn[data-page="{key}"]').first.click()
        page.wait_for_timeout(50)
        h1=page.locator('h1').first.inner_text()
        path=root/f'preview_{key}.png'
        page.screenshot(path=str(path), full_page=True)
        print(key, '=>', h1, '| screenshot', path.name)
    page.locator('#newRequest').click()
    page.wait_for_timeout(100)
    print('new request modal:', page.locator('#modalTitle').inner_text())
    page.screenshot(path=str(root/'preview_request_modal.png'), full_page=True)
    page.locator('[data-action="close-modal"]').first.click()
    page.locator('.nav-btn[data-page="quotations"]').first.click()
    page.locator('[data-action="approve-quote"]').first.click()
    page.wait_for_timeout(100)
    print('approval action modal:', page.locator('#modalTitle').inner_text())
    print('page errors:', errors)
    # mobile smoke
    mobile=browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1)
    mobile.set_content((root/'index.html').read_text(), wait_until='load')
    mobile.wait_for_timeout(100)
    mobile.screenshot(path=str(root/'preview_mobile.png'), full_page=True)
    print('mobile width:', mobile.locator('body').evaluate('(el)=>el.scrollWidth'), 'viewport:', 390)
    browser.close()
