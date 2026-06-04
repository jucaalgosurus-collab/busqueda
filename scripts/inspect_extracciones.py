import pandas as pd
import os

filepath = r"C:\Users\JUAN CARLOS\Desktop\Helen\Extracciones.xlsx"
if os.path.exists(filepath):
    try:
        xl = pd.ExcelFile(filepath)
        print("Sheets in Extracciones.xlsx:", xl.sheet_names)
        df = xl.parse(xl.sheet_names[0])
        print("Columns:", df.columns.tolist())
        print("Shape:", df.shape)
        print(df.head(15))
    except Exception as e:
        print("Error:", e)
else:
    print("Not found")
