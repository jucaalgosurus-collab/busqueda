import pandas as pd

old_xlsx_path = r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx"
df_old = pd.read_excel(old_xlsx_path)

df_old.to_csv("scripts/old_rows_full.csv", index=False)
print("Saved all old rows to scripts/old_rows_full.csv. Row count:", len(df_old))
