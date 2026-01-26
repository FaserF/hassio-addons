import json
import sys

files = [
    r"c:\Users\fseitz\GitHub\hassio-addons\.github\renovate.json",
    r"c:\Users\fseitz\GitHub\hassio-addons\whatsapp\integration\renovate.json"
]

for file_path in files:
    print(f"Checking {file_path}...")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            json.load(f)
        print(f"✅ Valid JSON: {file_path}")
    except Exception as e:
        print(f"❌ Invalid JSON in {file_path}: {e}")
