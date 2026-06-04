import pandas as pd

df_old = pd.read_excel(r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx")
df_new_a = pd.read_excel("scripts/Porcentajes_OptA_v2.xlsx")

print("OLD COLUMNS TYPES:")
print(df_old.dtypes)
print("\nNEW COLUMNS TYPES:")
print(df_new_a.dtypes)

print("\nOLD first 5 rows:")
print(df_old.head(5))

print("\nNEW first 5 rows:")
print(df_new_a.head(5))
