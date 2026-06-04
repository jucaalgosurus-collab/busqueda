import zipfile
import pandas as pd
import sys
import os

zip_path = r"C:\Users\JUAN CARLOS\Downloads\VALIDACIONES MAYO-20260603T170316Z-3-001.zip"
target_file = "VALIDACIONES MAYO/Control Helen-2026-05-30-13-52-11.xlsx"

def clean_val(v):
    if pd.isna(v):
        return ""
    s = str(v)
    return s.encode('ascii', errors='replace').decode('ascii')

if os.path.exists(zip_path):
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            with z.open(target_file) as f:
                xl = pd.ExcelFile(f)
                df = xl.parse(xl.sheet_names[0])
                print("Columns in Control Helen (cleaned):")
                cleaned_cols = [clean_val(c) for c in df.columns]
                print(cleaned_cols)
                
                df_clean = df.head(10).copy()
                df_clean.columns = cleaned_cols
                df_clean = df_clean.map(clean_val)
                print(df_clean.to_string())
    except Exception as e:
        print("Error:", e)
else:
    print("ZIP not found")
