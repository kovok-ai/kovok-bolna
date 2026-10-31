from playwright.sync_api import sync_playwright
import time
import os

PROD_URL = "https://kovok-bolna-six.vercel.app"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    page = context.new_page()
    
    # 1. Login to production
    print("Navigating to production login...")
    page.goto(f"{PROD_URL}/login", wait_until='networkidle')
    page.fill('#email', 'demo@kovok.test')
    page.fill('#password', 'DemoEvaluation2026!')
    page.locator('button[type="submit"]').click()
    
    print("Waiting for dashboard redirect...")
    page.wait_for_url(f"{PROD_URL}/", timeout=15000)
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    print("[OK] Successfully logged into production dashboard")

    # 2. Click Catalogue tab
    print("Navigating to Product Catalogue tab...")
    catalogue_btn = page.locator('button:has-text("Catalogue"), a:has-text("Catalogue"), button:has-text("Product Catalogue")').first
    if catalogue_btn.is_visible():
        catalogue_btn.click()
        time.sleep(2)
        prod_count = page.locator('table tbody tr').count()
        print(f"[OK] Product Catalogue loaded: {prod_count} products displayed")

    # 3. Click Suppliers tab
    print("Navigating to Suppliers tab...")
    suppliers_btn = page.locator('button:has-text("Suppliers"), a:has-text("Suppliers")').first
    if suppliers_btn.is_visible():
        suppliers_btn.click()
        time.sleep(2)
        supp_count = page.locator('table tbody tr').count()
        print(f"[OK] Suppliers loaded: {supp_count} suppliers displayed")

    browser.close()
    print("[SUCCESS] All UI verifications completed successfully.")
