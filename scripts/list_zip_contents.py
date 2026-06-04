import zipfile
import os

zip_path = r"C:\Users\JUAN CARLOS\Downloads\VALIDACIONES MAYO-20260603T170316Z-3-001.zip"

if os.path.exists(zip_path):
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            names = z.namelist()
            print(f"Total files in ZIP: {len(names)}")
            print("First 100 filenames:")
            for n in names[:100]:
                print(f"  {n}")
    except Exception as e:
        print("Error:", e)
else:
    print("Not found")
