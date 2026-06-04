import re

def parse_svg_vertices(svg_path):
    with open(svg_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract path d data
    paths = re.findall(r'<path[^>]+d="([^"]+)"', content)
    
    vertices = []
    for path in paths:
        # Find all coordinate pairs
        pairs = re.findall(r'([MLCclvzh])\s*(-?\d+)\s*(-?\d+)?', path)
        # Or let's just find all numbers in the path
        numbers = [float(n) for n in re.findall(r'-?\d+', path)]
        # Since it's SVG path data, numbers alternate X, Y (best effort)
        # Let's group them in pairs
        for i in range(0, len(numbers) - 1, 2):
            x = numbers[i]
            y = numbers[i+1]
            vertices.append((x, y))
            
    return vertices

def main():
    svg_path = r"C:\Users\JUAN CARLOS\Documents\ECCSystem\dossier-industrial-alimentario\presentaciones\corporate-pdf\assets\spain_downloaded.svg"
    vertices = parse_svg_vertices(svg_path)
    
    if not vertices:
        print("No vertices found.")
        return
        
    # Apply transform: x_t = x * 0.1, y_t = 1024 - y * 0.1
    transformed = []
    for x, y in vertices:
        x_t = x * 0.1
        y_t = 1024 - y * 0.1
        transformed.append((x_t, y_t))
        
    min_x = min(v[0] for v in transformed)
    max_x = max(v[0] for v in transformed)
    min_y = min(v[1] for v in transformed)
    max_y = max(v[1] for v in transformed)
    
    print(f"Transformed map bounding box:")
    print(f"  X: [{min_x:.2f}, {max_x:.2f}] (width: {max_x - min_x:.2f})")
    print(f"  Y: [{min_y:.2f}, {max_y:.2f}] (height: {max_y - min_y:.2f})")
    
    # Target bounding box of old map:
    # X: [50, 450] (width 400)
    # Y: [70, 370] (height 300)
    # Let's calculate scale and translation:
    scale_x = 400 / (max_x - min_x)
    scale_y = 300 / (max_y - min_y)
    scale = min(scale_x, scale_y)  # keep aspect ratio
    
    # New width and height after scaling:
    w_new = (max_x - min_x) * scale
    h_new = (max_y - min_y) * scale
    
    # Translate so it centers in the target box:
    # Target center: X = 250, Y = 220
    # Map center before translation (after scaling):
    cx_map_scaled = ((min_x + max_x) / 2) * scale
    cy_map_scaled = ((min_y + max_y) / 2) * scale
    
    tx = 250 - cx_map_scaled
    ty = 220 - cy_map_scaled
    
    print(f"\nRecommended transform:")
    print(f"  transform=\"translate({tx:.2f}, {ty:.2f}) scale({scale:.4f})\"")

if __name__ == "__main__":
    main()
