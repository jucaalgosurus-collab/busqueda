import sys
for pkg in ['fitz', 'pypdf', 'pdf2image', 'pdfplumber', 'pptx', 'openpyxl']:
    try:
        __import__(pkg)
        print(f"{pkg} is installed")
    except ImportError:
        print(f"{pkg} is NOT installed")
