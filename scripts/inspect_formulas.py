import openpyxl

new_file_path = r"C:\Users\JUAN CARLOS\Downloads\COMISIONES BANCOS 2026.xlsx"
wb = openpyxl.load_workbook(new_file_path, data_only=False)
sheet = wb['TODAS']

for r in range(5, 8):
    row_cells = [sheet.cell(r, c) for c in range(1, 47)]
    non_empty = [(c+1, cell.value) for c, cell in enumerate(row_cells) if cell.value is not None]
    print(f"Row {r:02d}:", non_empty)
