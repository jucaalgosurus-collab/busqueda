import pandas as pd

old_xlsx_path = r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx"
df_old = pd.read_excel(old_xlsx_path)

print(f"Total rows in old file: {len(df_old)}")
for i, row in df_old.iterrows():
    print(f"{i:03d}: Entidad={row['Entidad']} | Antigüedad={row['Antigüedad']} | Seguro={row['Seguro']} | TIN={row['TIN Aplicado']}")
