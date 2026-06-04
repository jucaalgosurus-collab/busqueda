import os
import sys
import fitz

def extract_pages(pdf_path, start_page, end_page, out_path):
    print(f"Extracting pages {start_page} to {end_page} from {pdf_path} to {out_path}...")
    if not os.path.exists(pdf_path):
        print("File not found.")
        return
        
    try:
        doc = fitz.open(pdf_path)
        out_lines = []
        for page_idx in range(start_page - 1, min(end_page, len(doc))):
            page = doc[page_idx]
            text = page.get_text()
            out_lines.append(f"\n--- PAGE {page_idx + 1} ---")
            out_lines.append(text)
            
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(out_lines))
        print("Successfully written to", out_path)
    except Exception as e:
        print(f"Error: {e}")

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    pdf_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\Surus\20260409_Participación UC3M_SURUS_S1_V1.pdf"
    out_path = r"C:\Users\JUAN CARLOS\.gemini\antigravity\brain\15425031-3fd2-4d79-aa8f-03303aa58060\scratch\extracted_pages_28_40.txt"
    extract_pages(pdf_path, 28, 40, out_path)

if __name__ == "__main__":
    main()
