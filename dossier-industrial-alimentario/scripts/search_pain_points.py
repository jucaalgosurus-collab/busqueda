import os
import fitz
import re

def search_text_in_pdf(pdf_path, search_terms):
    if not os.path.exists(pdf_path):
        return
    try:
        doc = fitz.open(pdf_path)
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text()
            for term in search_terms:
                if term.lower() in text.lower():
                    print(f"[{term}] found in {os.path.basename(pdf_path)} Page {page_idx+1}:")
                    for line in text.split('\n'):
                        if term.lower() in line.lower():
                            print(f"  {line.strip()}")
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")

def main():
    surus_dir = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\Surus"
    search_terms = ["problemas críticos", "Sustitución de", "Cierre de planta", "Reestructuración post", "dirección general", "concurso de", "reporting"]
    
    for f in os.listdir(surus_dir):
        if f.endswith('.pdf'):
            path = os.path.join(surus_dir, f)
            search_text_in_pdf(path, search_terms)

if __name__ == "__main__":
    main()
