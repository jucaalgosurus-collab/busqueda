import os
import glob

downloads_dir = r"C:\Users\JUAN CARLOS\Downloads"
types = ["*.xlsx", "*.xls", "*.csv", "*.xlsm"]

print("Excel and CSV files in Downloads:")
for t in types:
    for f in glob.glob(os.path.join(downloads_dir, t)):
        print(f"  {os.path.basename(f)} ({os.path.getsize(f)} bytes)")
