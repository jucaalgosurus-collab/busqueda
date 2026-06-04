import pandas as pd
import os

filepath = r"C:\Users\JUAN CARLOS\Downloads\HojaJuan.xls"
if os.path.exists(filepath):
    try:
        xl = pd.ExcelFile(filepath)
        print("Sheets in HojaJuan.xls:", xl.sheet_names)
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
        print("Error reading HojaJuan.xls:", e)
else:
    print("HojaJuan.xls does not exist.")
