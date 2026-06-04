import zipfile
import pandas as pd
import io
import os

zip_path = r"C:\Users\JUAN CARLOS\Downloads\VALIDACIONES MAYO-20260603T170316Z-3-001.zip"
target_file = "VALIDACIONES MAYO/Control Helen-2026-05-30-13-52-11.xlsx"

if os.path.exists(zip_path):
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            with z.open(target_file) as f:
                # Load with pandas
                xl = pd.ExcelFile(f)
                print("Sheets in Control Helen:", xl.sheet_names)
                for sheet in xl.sheet_names:
                    df = xl.parse(sheet, header=None)
                    for col in df.columns:
                        matches = df[df[col].astype(str).str.contains("iber", case=False, na=False)]
                        if len(matches) > 0:
                            print(f"Found in sheet {sheet}, column {col}:")
                            for idx, row in matches.iterrows():
                                row_clean = [f"{i}: {v}" for i, v in enumerate(row) if pd.notna(v)]
                                print(f"  Row {idx}:", " | ".join(row_clean))
    except Exception as e:
        print("Error reading Excel in ZIP:", e)
else:
    print("ZIP not found")
