import os
import fitz  # PyMuPDF
import pdfplumber

def search_pdf_pdfplumber(pdf_path, keywords):
    print(f"\nSearching with pdfplumber: {pdf_path}")
    if not os.path.exists(pdf_path):
        print("File not found.")
        return
        
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                text = page.extract_text()
                if not text:
                    continue
                for kw in keywords:
                    if kw.lower() in text.lower():
                        print(f"[{kw}] found on Page {page_idx+1}:")
                        for line in text.split('\n'):
                            if kw.lower() in line.lower():
                                print(f"  {line.strip()}")
    except Exception as e:
        print(f"Error reading with pdfplumber: {e}")

def search_pdf_fitz(pdf_path, keywords):
    print(f"\nSearching with fitz (PyMuPDF): {pdf_path}")
    if not os.path.exists(pdf_path):
        print("File not found.")
        return
        
    try:
        doc = fitz.open(pdf_path)
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text()
            if not text:
                continue
            for kw in keywords:
                if kw.lower() in text.lower():
                    print(f"[{kw}] found on Page {page_idx+1}:")
                    for line in text.split('\n'):
                        if kw.lower() in line.lower():
                            print(f"  {line.strip()}")
    except Exception as e:
        print(f"Error reading with fitz: {e}")

def main():
    surus_dir = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\Surus"
    files = [
        "SurusDossier.pdf",
        "Dossier Surus_ES_Alimentación y Bebidas_2603 (2).pdf",
        "Dossier Surus_ES_Alimentación y Bebidas_2603 (1).pdf",
        "Presentación SURUS - PESCANOVA.pdf",
        "20260409_Participación UC3M_SURUS_S1_V1.pdf"
    ]
    
    keywords = ["fase", "core", "continuidad", "ejecución", "desimplantación"]
    
    for f in files:
        path = os.path.join(surus_dir, f)
        search_pdf_fitz(path, keywords)

if __name__ == "__main__":
    main()
