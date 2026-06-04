import pandas as pd
import openpyxl

new_xlsx_path = r"C:\Users\JUAN CARLOS\Downloads\COMISIONES BANCOS 2026.xlsx"
old_xlsx_path = r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx"

print("--- Searching in OLD file ---")
df_old = pd.read_excel(old_xlsx_path)
for col in df_old.columns:
    matches = df_old[df_old[col].astype(str).str.contains("iber", case=False, na=False)]
    if len(matches) > 0:
        print(f"Matches in column '{col}':")
        print(matches[[col]])

print("\n--- Searching in NEW file ---")
df_new = pd.read_excel(new_xlsx_path, header=None)
for col in df_new.columns:
    matches = df_new[df_new[col].astype(str).str.contains("iber", case=False, na=False)]
    if len(matches) > 0:
        print(f"Matches in column {col}:")
        for idx, row in matches.iterrows():
            print(f"  Row {idx}: {row[col]}")
