import pandas as pd

df = pd.read_excel(r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx")
print("Columns in df_old:", df.columns.tolist())
for c in df.columns:
    print(f"Col: {repr(c)}")
