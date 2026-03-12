import os
import sys
import yaml
import json
import re

def strip_keys(data):
    if isinstance(data, dict):
        return {k.strip(): strip_keys(v) for k, v in data.items()}
    if isinstance(data, list):
        return [strip_keys(i) for i in data]
    return data

def load_file(file_path):
    if not os.path.exists(file_path):
        return None
    
    ext = os.path.splitext(file_path)[1].lower()
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = None
            if ext in [".yaml", ".yml"]:
                data = yaml.safe_load(f)
            elif ext == ".json":
                data = json.load(f)
            
            if data and isinstance(data, dict):
                return strip_keys(data)
            return data
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
    return None

def get_schema_keys(schema, prefix=""):
    keys = set()
    if isinstance(schema, list):
        for item in schema:
            if isinstance(item, dict):
                keys.update(get_schema_keys(item, prefix))
        return keys
        
    if not isinstance(schema, dict):
        return keys
    
    for key, value in schema.items():
        full_key = f"{prefix}:{key}" if prefix else key
        keys.add(full_key)
        
        if isinstance(value, dict):
            keys.update(get_schema_keys(value, full_key))
        elif isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
            keys.update(get_schema_keys(value[0], full_key))
            
    return keys

def find_translation(conf_trans, full_key):
    # Try 1: Exact nested match (split by :)
    key_parts = full_key.split(":")
    current = conf_trans
    found_nested = True
    for part in key_parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            found_nested = False
            break
    if found_nested and isinstance(current, dict) and ("name" in current or "description" in current):
        return current

    # Try 2: Flattened dotted match (e.g. database.type)
    dotted_key = full_key.replace(":", ".")
    if dotted_key in conf_trans:
        return conf_trans[dotted_key]

    # Try 3: Flattened colon match (e.g. database:type)
    if full_key in conf_trans:
        return conf_trans[full_key]

    # Try 4: Last part only (risky but matches some styles)
    last_part = key_parts[-1]
    if last_part in conf_trans:
        return conf_trans[last_part]

    return None

def check_informal_form(text):
    """
    Check if the text contains formal German forms (Sie, Ihr, Ihre, etc.)
    Note: 'Sie' (capitalized) is formal, 'sie' (lowercase) is 'they'.
    We check for 'Sie ', ' Ihr ', ' Ihre ', ' Ihnen ' but allow 'Sie ' at start of sentence if it could be 'They'.
    However, in addon descriptions, 'Sie' is almost always personal address.
    """
    if not text:
        return True, ""
    
    # Common formal indicators. 
    # Must be careful with 'Sie' at the start of a sentence.
    # But usually in these contexts, address is directed at the user.
    formal_patterns = [
        r'\bSie\b',
        r'\bIhr\b',
        r'\bIhre\b',
        r'\bIhrem\b',
        r'\bIhren\b',
        r'\bIhrer\b',
        r'\bIhres\b',
        r'\bIhnen\b',
    ]
    
    for pattern in formal_patterns:
        if re.search(pattern, text):
            # Special case: allow 'Sie' if it's clearly 'They' (plural) - hard to detect perfectly.
            # But per user request, we should probably stick to informal 'Du'.
            return False, f"Found formal form matching {pattern!r}"
            
    return True, ""

def check_translations(addon_path):
    errors = []
    config = load_file(os.path.join(addon_path, "config.yaml")) or \
             load_file(os.path.join(addon_path, "config.json"))
    
    if not config or "schema" not in config:
        return True, [] 
    
    schema = config.get("schema", {})
    schema_keys = get_schema_keys(schema)
    
    if not schema_keys:
        return True, []
    
    langs = ["en", "de"]
    for lang in langs:
        trans_file = os.path.join(addon_path, "translations", f"{lang}.yaml")
        if not os.path.exists(trans_file):
            trans_file = os.path.join(addon_path, "translations", f"{lang}.json")
            
        if not os.path.exists(trans_file):
            errors.append(f"Missing translation file for {lang!r}")
            continue
            
        trans = load_file(trans_file)
        if not trans or "configuration" not in trans:
            errors.append(f"Translation file for {lang!r} is missing 'configuration' section")
            continue
            
        conf_trans = trans["configuration"]
            
        for key in sorted(list(schema_keys)):
            trans_entry = find_translation(conf_trans, key)
            
            if not trans_entry:
                errors.append(f"Missing translation for {key!r} in {lang!r}")
            else:
                if not isinstance(trans_entry, dict):
                    errors.append(f"Translation entry for {key!r} in {lang!r} should be a dictionary")
                else:
                    if "name" not in trans_entry and "description" not in trans_entry:
                        errors.append(f"Translation for {key!r} in {lang!r} missing both 'name' and 'description'")
                    
                    if lang == "de":
                        for field in ["name", "description"]:
                            text = trans_entry.get(field, "")
                            if isinstance(text, str):
                                is_informal, reason = check_informal_form(text)
                                if not is_informal:
                                    errors.append(f"Formal form detected in {lang!r} translation for {key!r} field {field!r}: {reason}")

    return len(errors) == 0, errors

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    
    base_path = os.getcwd()
    if len(sys.argv) > 1:
        addons = [os.path.abspath(a) for a in sys.argv[1:] if os.path.isdir(a)]
    else:
        addons = []
        for item in os.listdir(base_path):
            item_path = os.path.join(base_path, item)
            if os.path.isdir(item_path) and not item.startswith("."):
                if os.path.exists(os.path.join(item_path, "config.yaml")) or \
                   os.path.exists(os.path.join(item_path, "config.json")):
                    addons.append(item_path)

    failed = False
    for addon in sorted(addons):
        passed, errors = check_translations(addon)
        if not passed:
            print(f"--- Translation Issues in {os.path.basename(addon)} ---")
            for err in errors:
                print(f"  - {err}")
            failed = True

    if failed:
        sys.exit(1)
    else:
        print("All translations verified (including informal form check).")

if __name__ == "__main__":
    main()
