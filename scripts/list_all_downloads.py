import os
import glob

downloads_dir = r"C:\Users\JUAN CARLOS\Downloads"
files = [os.path.join(downloads_dir, f) for f in os.listdir(downloads_dir)]
files = [f for f in files if os.path.isfile(f)]
files.sort(key=lambda x: os.path.getmtime(x), reverse=True)

print(f"Total files in Downloads: {len(files)}")
print("Top 40 most recent files:")
for f in files[:40]:
    mtime = os.path.getmtime(f)
    import datetime
    dt = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
    print(f"  {dt} | {os.path.getsize(f):10d} bytes | {os.path.basename(f)}")
