import pandas as pd
import os
import sys

filepath = r"C:\Users\JUAN CARLOS\Desktop\Helen\Extracciones.xlsx"
if os.path.exists(filepath):
    try:
        xl = pd.ExcelFile(filepath)
        df = xl.parse(xl.sheet_names[0])
        print("Columns:", df.columns.tolist())
        print("Shape:", df.shape)
        # Clean unicode characters for safe console print
        text = df.head(15).to_string()
        print(text.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
    except Exception as e:
        print("Error:", e)
else:
    print("Not found")
