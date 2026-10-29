"""
Kovok Construction UI — Portable Smoke Test Harness
Cross-platform compatible (Windows, Linux, macOS)
Does not hardcode /usr/bin/chromium or /mnt/data Linux paths.
"""

import sys
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

def run_portable_smoke_test():
    # Resolve directory relative to this script or current working directory
    workspace_root = Path(__file__).resolve().parent.parent
    prototype_dir = workspace_root / 'Kovok_Construction_UI_Premium'
    html_path = prototype_dir / 'index.html'

    if not html_path.exists():
        print(f"Error: index.html not found at {html_path}")
        sys.exit(1)

    print("=================================================================")
    print("   KOVOK CONSTRUCTION UI — PORTABLE SMOKE TEST")
    print(f"   Platform: {sys.platform} | Target: {html_path.name}")
    print("=================================================================\n")

    with sync_playwright() as pw:
        # Launch using standard playwright chromium (portable across OS)
        browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        # Load prototype
        page.set_content(html_path.read_text(encoding='utf-8'), wait_until='load')
        page.wait_for_timeout(200)
        print(f"Page Title: {page.title()}")

        # Test all navigation tabs
        pages = ['overview', 'requests', 'quotations', 'orders', 'exceptions', 'catalog', 'suppliers', 'integrations', 'settings']
        for key in pages:
            nav_btn = page.locator(f'.nav-btn[data-page="{key}"]').first
            nav_btn.click()
            page.wait_for_timeout(60)
            h1 = page.locator('h1').first.inner_text()
            print(f"  • View [{key}]: Header = '{h1}'")

        # Test New Request Modal
        page.locator('#newRequest').click()
        page.wait_for_timeout(100)
        modal_title = page.locator('#modalTitle').inner_text()
        print(f"  • New Request Modal: Title = '{modal_title}'")
        page.locator('[data-action="close-modal"]').first.click()

        # Test Quotation Approval Modal
        page.locator('.nav-btn[data-page="quotations"]').first.click()
        page.locator('[data-action="approve-quote"]').first.click()
        page.wait_for_timeout(100)
        approval_title = page.locator('#modalTitle').inner_text()
        print(f"  • Approval Action Modal: Title = '{approval_title}'")
        page.locator('[data-action="close-modal"]').first.click()

        # Test Mobile Viewport Responsive Behavior
        mobile = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        mobile.set_content(html_path.read_text(encoding='utf-8'), wait_until='load')
        mobile.wait_for_timeout(100)
        scroll_width = mobile.locator('body').evaluate('(el) => el.scrollWidth')
        print(f"  • Mobile Viewport (390px): Body scrollWidth = {scroll_width}px")

        browser.close()

        if errors:
            print(f"\nPage Errors Detected: {errors}")
            sys.exit(1)
        else:
            print("\nSUCCESS: Portable smoke test completed with 0 page errors!\n")

if __name__ == '__main__':
    run_portable_smoke_test()
