import pandas as pd
import os

filepath = r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx"
df = pd.read_excel(filepath)

print("CAIXA rows in final file:")
print(df[df['Entidad'] == 'CAIXA'].to_string())
