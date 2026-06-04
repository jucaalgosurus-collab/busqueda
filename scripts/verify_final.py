import pandas as pd
import os

old_dir = r"C:\Users\JUAN CARLOS\Desktop\Helen"
xlsx_path = os.path.join(old_dir, "Porcentajes.xlsx")
csv_path = os.path.join(old_dir, "Porcentajes.csv")

print("Checking written files:")
if os.path.exists(xlsx_path):
    df_xl = pd.read_excel(xlsx_path)
    print(f"  XLSX: rows = {len(df_xl)}, cols = {df_xl.columns.tolist()}")
    print("  Unique banks in XLSX:", df_xl['Entidad'].unique().tolist())
else:
    print("  XLSX not found!")

if os.path.exists(csv_path):
    df_csv = pd.read_csv(csv_path, encoding='utf-8-sig')
    print(f"  CSV: rows = {len(df_csv)}, cols = {df_csv.columns.tolist()}")
    print("  Unique banks in CSV:", df_csv['Entidad'].unique().tolist())
else:
    print("  CSV not found!")
