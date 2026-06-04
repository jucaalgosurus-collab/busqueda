import pandas as pd
import math

new_file_path = r"C:\Users\JUAN CARLOS\Downloads\COMISIONES BANCOS 2026.xlsx"
df_new = pd.read_excel(new_file_path, header=None)

# Let's map sections
# Section 1: rows 1 to 11 (0-indexed: row 1 is header, 3 is months, 4 is banks, 5 is TIN=0.0599 specific, 6-11 are TIN rows)
# Wait, let's see how each section is structured.
# Let's write a parser that extracts the info.

def parse_section(df, start_row, num_rows, age_text, seguro_val):
    # Months are at start_row + 2
    # Banks are at start_row + 3
    # Rows of data are from start_row + 4 to start_row + 4 + num_rows - 1
    months_row = df.iloc[start_row + 2].tolist()
    banks_row = df.iloc[start_row + 3].tolist()
    
    # Fill months_row forward to associate each column with its month
    current_month = None
    cols_mapping = {} # col_idx -> (month, bank)
    for col_idx in range(1, len(months_row)):
        m = months_row[col_idx]
        b = banks_row[col_idx]
        if pd.notna(m):
            current_month = str(m).strip()
        if pd.notna(b):
            cols_mapping[col_idx] = (current_month, str(b).strip())
            
    print(f"\n--- Section: {age_text} | Seguro: {seguro_val} ---")
    print(f"Column mapping count: {len(cols_mapping)}")
    
    extracted_data = []
    # Data rows
    for r in range(start_row + 4, start_row + 4 + num_rows):
        if r >= df.shape[0]:
            break
        row_label = df.iloc[r, 0]
        if pd.isna(row_label):
            continue
        row_label = str(row_label).strip()
        
        # We need to extract the TIN.
        # E.g., "5,99% - BBVA 5,99%" or "0.0599" or "6,99% - BBVA 7,25%"
        # Let's see how to map TINs.
        
        # Let's read column values
        col_vals = {}
        for col_idx, (month, bank) in cols_mapping.items():
            val = df.iloc[r, col_idx]
            if pd.notna(val):
                col_vals[(month, bank)] = val
        
        print(f"Row {r} label: '{row_label}' | Cols with values: {len(col_vals)}")
        extracted_data.append({
            'row_idx': r,
            'label': row_label,
            'values': col_vals
        })
    return extracted_data

# Section 1: Coches de hasta 95 meses - CON SEGURO DE VIDA
# Row 1 is the header (index 1)
# Months at Row 3 (index 3)
# Banks at Row 4 (index 4)
# Data: Row 5 (index 5) is TIN 0.0599. Rows 6-11 are TINs 5.99% to 10.99%
# So start_row=1, data rows=7
s1 = parse_section(df_new, 1, 11, "Hasta 95 meses", "Si")

# Section 2: Coches de hasta 95 meses - SIN SEGURO DE VIDA
# Row 13 is header (index 13)
# Months at Row 15 (index 15)
# Banks at Row 16 (index 16)
# Data: Row 17 (index 17) is TIN 0.0599. Rows 18-23 are TINs 5.99% to 10.99%
# start_row=13, data rows=7
s2 = parse_section(df_new, 13, 11, "Hasta 95 meses", "No")

# Section 3: Coches desde 96 meses - CON SEGURO DE VIDA
# Row 25 is header (index 25)
# Months at Row 27 (index 27)
# Banks at Row 28 (index 28)
# Data: Row 29 (index 29) is TIN 0.0599. Rows 30-34 are TINs 6.99% to 10.99%
# start_row=25, data rows=6
s3 = parse_section(df_new, 25, 10, "Desde 96 meses", "Si")

# Section 4: Coches desde 96 meses - SIN SEGURO DE VIDA
# Row 36 is header (index 36)
# Months at Row 38 (index 38)
# Banks at Row 39 (index 39)
# Data: Row 40 (index 40) is TIN 0.0599. Rows 41-45 are TINs 6.99% to 10.99%
# start_row=36, data rows=6
s4 = parse_section(df_new, 36, 10, "Desde 96 meses", "No")
