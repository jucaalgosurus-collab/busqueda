import urllib.request
import re

def main():
    url = "https://alimentos-ten.vercel.app/SURUS-Alimentacion-Bebidas-2026"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8', errors='ignore')
            
        print("Live slide 4 contents:")
        # Look for class="dolor" blocks
        dolores = re.findall(r'<div class="dolor">.*?<h3>(.*?)</h3>', html, re.DOTALL)
        for idx, d in enumerate(dolores):
            print(f"  {idx+1}: {d.strip()}")
            
        print("\nLive slide 6 contents (methodology):")
        metodo = re.findall(r'<span class="met-t">(.*?)</span>', html)
        for idx, m in enumerate(metodo):
            print(f"  {idx+1}: {m.strip()}")
    except Exception as e:
        print("Error fetching:", e)

if __name__ == "__main__":
    main()
