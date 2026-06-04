import pandas as pd
import sys
import os

filepath = r"C:\Users\JUAN CARLOS\Desktop\Helen\Entregas.xlsx"
if os.path.exists(filepath):
    try:
        df = pd.read_excel(filepath)
        text = df.head(20).to_string()
        print(text.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
    except Exception as e:
        print("Error:", e)
else:
    print("Not found")
