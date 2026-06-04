import pandas as pd

old_xlsx_path = r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx"
df_old = pd.read_excel(old_xlsx_path)

print("Columns:", list(df_old.columns))
print("Unique Entidades in order of appearance:")
print(df_old['Entidad'].unique())

print("\nUnique Antigüedad in order of appearance:")
print(df_old['Antigüedad'].unique())

print("\nUnique Seguro in order of appearance:")
print(df_old['Seguro'].unique())

print("\nUnique TIN Aplicado in order of appearance:")
print(df_old['TIN Aplicado'].unique())

print("\nFirst 30 rows of the old file:")
print(df_old.head(30).to_string())
