from playwright.sync_api import sync_playwright
import os

def main():
    html_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\presentaciones\corporate-pdf\SURUS-Alimentacion-Bebidas-2026.html"
    out_dir = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\presentaciones\corporate-pdf\_validate-desktop"
    
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
        
    with sync_playwright() as p:
        # Launch Chrome (same path as validate-s11.mjs)
        browser = p.chromium.launch(
            executable_path='C:/Users/JUAN CARLOS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(f"file:///{html_path}")
        page.wait_for_timeout(2000)
        
        # Scroll to Slide 10 (which is 1-indexed, i.e. data-slide="10")
        page.evaluate("document.querySelector('[data-slide=\"10\"]').scrollIntoView({behavior: 'instant'})")
        page.wait_for_timeout(1500)
        
        out_path = os.path.join(out_dir, "s11-slide10-map.png")
        page.screenshot(path=out_path)
        print("Captured screenshot to", out_path)
        browser.close()

if __name__ == "__main__":
    main()
