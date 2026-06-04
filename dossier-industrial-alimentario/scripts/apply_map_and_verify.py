import re
import os
import subprocess

def main():
    html_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\presentaciones\corporate-pdf\SURUS-Alimentacion-Bebidas-2026.html"
    svg_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\presentaciones\corporate-pdf\assets\spain_downloaded.svg"
    
    with open(svg_path, "r", encoding="utf-8") as f:
        svg_content = f.read()
        
    # Extract paths from the downloaded SVG
    paths = re.findall(r'<path[^>]+d="([^"]+)"', svg_content)
    
    # Generate the new SVG markup for the map
    new_svg_markup = """<g class="mapa-region" transform="translate(89.08, 25.22) scale(0.3309)">
            <g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)" stroke="var(--line-strong)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">"""
    
    for p in paths:
        new_svg_markup += f'\n              <path d="{p}" fill="var(--bg-elev-1)" />'
        
    new_svg_markup += """\n            </g>
          </g>"""
          
    # Read HTML
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    # We want to replace the old <g class="mapa-region" ...> ... </g> block
    # Let's locate the start and end of the <g class="mapa-region" ...> </g> block in slide 10
    start_tag = '<g class="mapa-region"'
    idx = html_content.find(start_tag)
    if idx == -1:
        print("Error: Could not find <g class=\"mapa-region\" in HTML.")
        return
        
    # Find matching closing </g> for the group (which contains Peninsula, Baleares, Canary Inset etc.)
    # In the HTML, it ends right before <!-- Active pins linked to JS -->
    end_marker = '<!-- Active pins linked to JS -->'
    end_idx = html_content.find(end_marker)
    if end_idx == -1:
        print("Error: Could not find pins marker in HTML.")
        return
        
    # We replace from idx to end_idx (leaving the pins marker untouched)
    old_section = html_content[idx:end_idx]
    
    # We replace it with our new_svg_markup plus some whitespace
    new_content = html_content[:idx] + new_svg_markup + "\n          " + html_content[end_idx:]
    
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print("Successfully replaced map in HTML.")
    
    # Now let's run the validation script to check if everything works and take screenshots
    print("Running validate-s11.mjs...")
    res = subprocess.run(["node", "dossier-industrial-alimentario/presentaciones/corporate-pdf/validate-s11.mjs"], capture_output=True, text=True)
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)

if __name__ == "__main__":
    main()
