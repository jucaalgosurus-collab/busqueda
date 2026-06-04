import os
import sys
import fitz

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    pdf_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\Surus\Dossier Surus_ES_Alimentación y Bebidas_2603 (2).pdf"
    if not os.path.exists(pdf_path):
         print("File not found")
         return
         
    doc = fitz.open(pdf_path)
    # Print page 8 text (0-indexed page 7)
    print("Page 8 content:")
    print(doc[7].get_text())

if __name__ == "__main__":
    main()
