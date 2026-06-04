import pandas as pd
import os

filepath = r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx"
df = pd.read_excel(filepath)

print("Row count per bank in final file:")
print(df['Entidad'].value_counts())

print("\nDetail of LENDROCK rows:")
print(df[df['Entidad'] == 'LENDROCK'].to_string())
