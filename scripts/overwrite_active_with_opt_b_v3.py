import pandas as pd
import os

old_dir = r"C:\Users\JUAN CARLOS\Desktop\Helen"
old_xlsx = os.path.join(old_dir, "Porcentajes.xlsx")
old_csv = os.path.join(old_dir, "Porcentajes.csv")

# Load Option B v3
df_opt_b = pd.read_excel("scripts/Porcentajes_OptB_v3.xlsx")

# Try to overwrite
print("Attempting to overwrite active files with Option B v3 (All 8 banks with precision fixes)...")
try:
    df_opt_b.to_excel(old_xlsx, sheet_name="Sheet1", index=False)
    df_opt_b.to_csv(old_csv, index=False, encoding="utf-8-sig")
    print("SUCCESS: Successfully overwrote active files with Option B v3!")
except PermissionError as pe:
    print(f"FAILED: Permission denied. The files are probably still open in Excel. Error: {pe}")
except Exception as e:
    print(f"FAILED: Error: {e}")
