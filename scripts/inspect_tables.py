import pandas as pd
import os

new_file_path = r"C:\Users\JUAN CARLOS\Downloads\COMISIONES BANCOS 2026.xlsx"
old_xlsx_path = r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.xlsx"
old_csv_path = r"C:\Users\JUAN CARLOS\Desktop\Helen\Porcentajes.csv"

print("--- NEW FILE ---")
if os.path.exists(new_file_path):
    try:
        xl_new = pd.ExcelFile(new_file_path)
        print("Sheet names:", xl_new.sheet_names)
        df_new = xl_new.parse(xl_new.sheet_names[0])
        print("Columns:", list(df_new.columns))
        print("Shape:", df_new.shape)
        print(df_new.head(10))
    except Exception as e:
        print("Error reading new file:", e)
else:
    print("New file does not exist at:", new_file_path)

print("\n--- OLD XLSX FILE ---")
if os.path.exists(old_xlsx_path):
    try:
        xl_old = pd.ExcelFile(old_xlsx_path)
        print("Sheet names:", xl_old.sheet_names)
        df_old = xl_old.parse(xl_old.sheet_names[0])
        print("Columns:", list(df_old.columns))
        print("Shape:", df_old.shape)
        print(df_old.head(10))
    except Exception as e:
        print("Error reading old xlsx file:", e)
else:
    print("Old xlsx file does not exist at:", old_xlsx_path)

print("\n--- OLD CSV FILE ---")
if os.path.exists(old_csv_path):
    try:
        df_old_csv = pd.read_csv(old_csv_path, sep=None, engine='python')
        print("Columns:", list(df_old_csv.columns))
        print("Shape:", df_old_csv.shape)
        print(df_old_csv.head(10))
    except Exception as e:
        print("Error reading old csv file:", e)
else:
    print("Old csv file does not exist at:", old_csv_path)
