import os

directories = ["c:\\Users\\prafull jamsandekar\\PycharmProjects\\HospitalProject\\web_app\\frontend", "c:\\Users\\prafull jamsandekar\\PycharmProjects\\HospitalProject\\web_app\\backend"]

def replace_terms(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith((".py", ".html", ".js")) and "setup_global_features.py" not in file and "setup_superadmin.py" not in file:
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                if "Super Admin HQ" in content or "Super Admin" in content:
                    content = content.replace("Super Admin HQ", "System HQ")
                    content = content.replace("Super Admin", "System Administrator")
                    
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"Updated {file}")

for directory in directories:
    replace_terms(directory)
