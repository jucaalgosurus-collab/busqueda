import pandas as pd
import shutil
import os

old_dir = r"C:\Users\JUAN CARLOS\Desktop\Helen"
old_xlsx = os.path.join(old_dir, "Porcentajes.xlsx")
old_csv = os.path.join(old_dir, "Porcentajes.csv")

# 1. Backups
backup_xlsx = os.path.join(old_dir, "Porcentajes_old_backup.xlsx")
backup_csv = os.path.join(old_dir, "Porcentajes_old_backup.csv")

print("Creating backups of old files...")
if os.path.exists(old_xlsx):
    try:
        shutil.copy2(old_xlsx, backup_xlsx)
        print(f"Backed up {old_xlsx} to {backup_xlsx}")
    except Exception as e:
        print(f"Could not backup {old_xlsx}: {e}")

if os.path.exists(old_csv):
    try:
        shutil.copy2(old_csv, backup_csv)
        print(f"Backed up {old_csv} to {backup_csv}")
    except Exception as e:
        print(f"Could not backup {old_csv}: {e}")

# 2. Load the generated df_final_opt_a and df_final_opt_b from v2
df_opt_a = pd.read_excel("scripts/Porcentajes_OptA_v2.xlsx")
df_opt_b = pd.read_excel("scripts/Porcentajes_OptB_v2.xlsx")

# 3. Save to new files (Option A - Original Banks) under a new name to avoid lock issues
new_opt_a_xlsx = os.path.join(old_dir, "Porcentajes_Nuevos_2026.xlsx")
new_opt_a_csv = os.path.join(old_dir, "Porcentajes_Nuevos_2026.csv")
df_opt_a.to_excel(new_opt_a_xlsx, sheet_name="Sheet1", index=False)
df_opt_a.to_csv(new_opt_a_csv, index=False, encoding="utf-8-sig")
print(f"Saved Option A to: {new_opt_a_xlsx} and {new_opt_a_csv}")

# 4. Save to new files (Option B - All Banks)
new_opt_b_xlsx = os.path.join(old_dir, "Porcentajes_Completo_Con_Nuevos.xlsx")
new_opt_b_csv = os.path.join(old_dir, "Porcentajes_Completo_Con_Nuevos.csv")
df_opt_b.to_excel(new_opt_b_xlsx, sheet_name="Sheet1", index=False)
df_opt_b.to_csv(new_opt_b_csv, index=False, encoding="utf-8-sig")
print(f"Saved Option B to: {new_opt_b_xlsx} and {new_opt_b_csv}")

# 5. Try to overwrite the active files (Option A - Original Banks only)
try:
    df_opt_a.to_excel(old_xlsx, sheet_name="Sheet1", index=False)
    df_opt_a.to_csv(old_csv, index=False, encoding="utf-8-sig")
    print(f"Successfully overwrote active files: {old_xlsx} and {old_csv}")
except PermissionError as pe:
    print(f"Warning: Could not overwrite active files because they are open/locked. Error: {pe}")
except Exception as e:
    print(f"Error overwriting active files: {e}")
