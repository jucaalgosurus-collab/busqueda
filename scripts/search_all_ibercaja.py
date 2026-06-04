import os
import pandas as pd
import glob

dirs = [
    r"C:\Users\JUAN CARLOS\Desktop\Helen",
    r"C:\Users\JUAN CARLOS\Downloads"
]

print("Searching for 'iber' case-insensitive in all files in directories...")

for d in dirs:
    print(f"\nDirectory: {d}")
    # XLSX files
    for filepath in glob.glob(os.path.join(d, "*.xlsx")):
        # Skip backup and temporary files
        if "~$" in filepath or "_backup" in filepath or "Porcentajes_Opt" in filepath or "Porcentajes_Completo" in filepath:
            continue
        try:
            xl = pd.ExcelFile(filepath)
            for sheet in xl.sheet_names:
                df = xl.parse(sheet, header=None)
                for col in df.columns:
                    matches = df[df[col].astype(str).str.contains("iber", case=False, na=False)]
                    if len(matches) > 0:
                        print(f"Found in excel {os.path.basename(filepath)}, sheet {sheet}, column {col}:")
                        for idx, row in matches.iterrows():
                            # Print non-null values in the row to show context
                            row_clean = [f"{i}: {v}" for i, v in enumerate(row) if pd.notna(v)]
                            print(f"  Row {idx}:", " | ".join(row_clean))
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            
    # CSV files
    for filepath in glob.glob(os.path.join(d, "*.csv")):
        if "_backup" in filepath or "Porcentajes_Opt" in filepath or "Porcentajes_Completo" in filepath:
            continue
        try:
            # try to read
            df = pd.read_csv(filepath, sep=None, engine='python', header=None)
            for col in df.columns:
                matches = df[df[col].astype(str).str.contains("iber", case=False, na=False)]
                if len(matches) > 0:
                    print(f"Found in csv {os.path.basename(filepath)}, column {col}:")
                    for idx, row in matches.iterrows():
                        row_clean = [f"{i}: {v}" for i, v in enumerate(row) if pd.notna(v)]
                        print(f"  Row {idx}:", " | ".join(row_clean))
        except Exception as e:
            # Try with encoding sig or other
            try:
                df = pd.read_csv(filepath, sep=None, engine='python', header=None, encoding='utf-8-sig')
                for col in df.columns:
                    matches = df[df[col].astype(str).str.contains("iber", case=False, na=False)]
                    if len(matches) > 0:
                        print(f"Found in csv {os.path.basename(filepath)}, column {col}:")
                        for idx, row in matches.iterrows():
                            row_clean = [f"{i}: {v}" for i, v in enumerate(row) if pd.notna(v)]
                            print(f"  Row {idx}:", " | ".join(row_clean))
            except Exception as e2:
                print(f"Error reading csv {filepath}: {e2}")
