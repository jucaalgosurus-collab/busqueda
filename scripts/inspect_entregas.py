import pandas as pd
import os

filepath = r"C:\Users\JUAN CARLOS\Desktop\Helen\Entregas.xlsx"
if os.path.exists(filepath):
    try:
        xl = pd.ExcelFile(filepath)
        print("Sheets in Entregas.xlsx:", xl.sheet_names)
        for s in xl.sheet_names:
            df = xl.parse(s)
            print(f"Sheet {s} shape: {df.shape}")
            print(f"Columns: {df.columns.tolist()[:10]}")
    except Exception as e:
        print("Error:", e)
else:
    print("Not found")
