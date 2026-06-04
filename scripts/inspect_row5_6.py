import pandas as pd

new_file_path = r"C:\Users\JUAN CARLOS\Downloads\COMISIONES BANCOS 2026.xlsx"
df_new = pd.read_excel(new_file_path, header=None)

months_row = df_new.iloc[3].tolist()
banks_row = df_new.iloc[4].tolist()

# build column mapping
cols_mapping = {}
current_month = None
for col_idx in range(1, len(months_row)):
    m = months_row[col_idx]
    b = banks_row[col_idx]
    if pd.notna(m):
        current_month = str(m).strip()
    if pd.notna(b):
        cols_mapping[col_idx] = (current_month, str(b).strip())

# Print row 5 and 6 details
for r in [5, 6]:
    label = df_new.iloc[r, 0]
    print(f"\n--- Row {r}: {label} ---")
    for col_idx, (month, bank) in cols_mapping.items():
        val = df_new.iloc[r, col_idx]
        if pd.notna(val):
            print(f"  Month: {month} | Bank: {bank} | Val: {val}")
