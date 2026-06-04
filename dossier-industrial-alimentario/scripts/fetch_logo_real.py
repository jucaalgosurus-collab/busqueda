import urllib.request
import re
import os

def main():
    print("Fetching website www.surusin.com...")
    url = "https://www.surusin.com/"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8', errors='ignore')
        
        # Search for logo in image tags or links
        logos = re.findall(r'src="([^"]*logo[^"]*)"', html, re.IGNORECASE)
        print("Logos found:", logos)
        
        if not logos:
            logos = re.findall(r'href="([^"]*logo[^"]*)"', html, re.IGNORECASE)
            print("Href logos found:", logos)
            
        if logos:
            logo_url = logos[0]
            if logo_url.startswith("//"):
                logo_url = "https:" + logo_url
            elif logo_url.startswith("/"):
                logo_url = "https://www.surusin.com" + logo_url
            
            print(f"Downloading from {logo_url}...")
            # Download the logo
            target_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\presentaciones\corporate-pdf\assets\logo-web.png"
            urllib.request.urlretrieve(logo_url, target_path)
            print("Downloaded logo to", target_path)
        else:
            print("No logo URL found on the website.")
            
    except Exception as e:
        print("Error fetching logo:", e)

if __name__ == "__main__":
    main()
