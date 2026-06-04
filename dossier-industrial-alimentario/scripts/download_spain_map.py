import urllib.request
import re
import os

def try_download(url, target_path):
    # Set a detailed User-Agent to avoid Wikipedia 429
    headers = {
        "User-Agent": "SurusDecommissioningPresentation/1.0 (contact: info@surusin.com) Python-urllib/3.x"
    }
    try:
        print(f"Trying to download from {url}...")
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as r:
            svg_data = r.read().decode('utf-8', errors='ignore')
        
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(svg_data)
        
        paths = re.findall(r'<path[^>]+d="([^"]+)"', svg_data)
        print(f"Success! Saved to {target_path}. Found {len(paths)} paths.")
        return True
    except Exception as e:
        print(f"Failed: {e}")
        return False

def main():
    target_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\presentaciones\corporate-pdf\assets\spain_downloaded.svg"
    
    urls = [
        "https://upload.wikimedia.org/wikipedia/commons/2/27/Spain_blank_map.svg",
        "https://raw.githubusercontent.com/djaiss/mapsicon/master/all/es/vector.svg",
        "https://upload.wikimedia.org/wikipedia/commons/a/af/Spain_location_map.svg",
        "https://upload.wikimedia.org/wikipedia/commons/a/ac/EspanaCanariasProvincia.svg"
    ]
    
    for url in urls:
        if try_download(url, target_path):
            break

if __name__ == "__main__":
    main()
