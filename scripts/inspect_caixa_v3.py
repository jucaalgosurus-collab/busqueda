import pandas as pd

df = pd.read_excel("scripts/Porcentajes_OptB_v3.xlsx")

print("Row count per bank in v3:")
print(df['Entidad'].value_counts())

print("\nCAIXA rows in v3:")
print(df[df['Entidad'] == 'CAIXA'].to_string())
