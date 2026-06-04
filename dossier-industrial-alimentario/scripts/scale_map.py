import re

def parse_svg_paths(svg_path):
    with open(svg_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to extract paths and their transform
    # The main group has transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)"
    # Let's extract the path d attributes
    paths = re.findall(r'<path[^>]+d="([^"]+)"', content)
    return paths

def main():
    svg_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\presentaciones\corporate-pdf\assets\spain_downloaded.svg"
    paths = parse_svg_paths(svg_path)
    print(f"Loaded {len(paths)} paths.")
    
    # We can write out the new SVG code with a proper transform so it fits a 500x450 coordinate system.
    # Let's inspect the SVG viewBox: it is "0 0 1024 1024".
    # The transform translates (0, 1024) and scales (0.1, -0.1).
    # This means coordinates in the path d="M1157 8887 ..." are in the range [0, 10240].
    # In the transformed space, they become:
    # x_transformed = x * 0.1
    # y_transformed = 1024 - y * 0.1
    # For example, M1157 8887 becomes (115.7, 1024 - 888.7) = (115.7, 135.3)
    #
    # We want to map this 1024x1024 bounding box to our target coordinate box (500x450).
    # Currently the Spain map fits roughly in:
    # x: 50 to 450 (width 400)
    # y: 70 to 380 (height 310)
    #
    # If we place a group with transform in our presentation HTML:
    # <g class="mapa-region" transform="translate(50, 40) scale(0.40)">
    #   <g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)">
    #      <!-- paths here -->
    #   </g>
    # </g>
    # We can adjust translate and scale to position the map perfectly behind the pins!
    # Let's check where the pins are:
    # Sevilla: (115, 305) -> Real Spain coordinates: 37.38, -5.98
    # Madrid: (240, 240) -> Real Spain coordinates: 40.41, -3.70
    # Barcelona: (370, 200) -> Real Spain coordinates: 41.38, 2.17
    # A Coruña: (80, 100) -> Real Spain coordinates: 43.36, -8.41
    #
    # Let's output a test HTML snippet of the map with these paths so we can see it!
    # Let's print out the paths formatted for inclusion in the HTML.
    print("Paths ready to copy.")

if __name__ == "__main__":
    main()
