from playwright.sync_api import sync_playwright
import time
import os

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    page = context.new_page()
    
    # 1. Navigate to login
    print("Navigating to login page...")
    page.goto('http://localhost:3000/login', wait_until='networkidle')
    time.sleep(1)
    
    # 2. Fill login form
    page.fill('#email', 'demo@kovok.test')
    page.fill('#password', 'DemoEvaluation2026!')
    page.locator('button[type="submit"]').click()
    
    # 3. Wait for redirect to home dashboard
    print("Waiting for dashboard redirect...")
    page.wait_for_url('http://localhost:3000/', timeout=10000)
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    
    # 4. Capture screenshot
    os.makedirs('docs/images', exist_ok=True)
    screenshot_path = 'docs/images/kovok-product-demo.png'
    page.screenshot(path=screenshot_path, full_page=False)
    print(f"Successfully captured screenshot to {screenshot_path}")
    browser.close()
