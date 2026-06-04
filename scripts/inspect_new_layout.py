import pandas as pd
import openpyxl

new_file_path = r"C:\Users\JUAN CARLOS\Downloads\COMISIONES BANCOS 2026.xlsx"
df_new = pd.read_excel(new_file_path, header=None)

print("NEW FILE SHAPE:", df_new.shape)
for r in range(min(df_new.shape[0], 25)):
    row_vals = df_new.iloc[r].tolist()
    # clean up values to print them neatly
    row_vals_clean = [f"{i}: {v}" for i, v in enumerate(row_vals) if pd.notna(v)]
    print(f"Row {r:02d}:", " | ".join(row_vals_clean))
