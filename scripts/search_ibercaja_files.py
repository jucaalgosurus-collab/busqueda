import os
import fnmatch

search_paths = [
    r"C:\Users\JUAN CARLOS\Desktop",
    r"C:\Users\JUAN CARLOS\Downloads",
    r"C:\Users\JUAN CARLOS\Documents"
]

print("Searching for files containing 'iber' in the filename...")

for path in search_paths:
    print(f"\nSearching in: {path}")
    count = 0
    # Walk the directory
    for root, dirs, files in os.walk(path):
        # Skip some system or library dirs to make it fast
        if ".git" in root or "node_modules" in root or "AppData" in root:
            continue
        for file in files:
            if "iber" in file.lower():
                print(f"Found file: {os.path.join(root, file)}")
                count += 1
                if count >= 30:
                    print("Limit of 30 files reached for this path.")
                    break
        if count >= 30:
            break
