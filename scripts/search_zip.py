import zipfile
import os

zip_path = r"C:\Users\JUAN CARLOS\Downloads\VALIDACIONES MAYO-20260603T170316Z-3-001.zip"

print(f"Opening ZIP file: {zip_path}...")
if os.path.exists(zip_path):
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            names = z.namelist()
            print(f"Total files in ZIP: {len(names)}")
            matches = [n for n in names if "iber" in n.lower() or "comision" in n.lower() or "porcentajes" in n.lower()]
            print(f"Matches found: {len(matches)}")
            for m in matches[:50]:
                print(f"  {m}")
            if len(matches) > 50:
                print("  ... and more")
    except Exception as e:
        print("Error reading ZIP file:", e)
else:
    print("ZIP file does not exist.")
