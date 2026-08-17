import os
import shutil
import subprocess

REPO_DIR = r"C:\Users\shann\OmniVeo-HQ\01_PROJECTS\Stratemark\repo"
ELECTRON_DIST = os.path.join(REPO_DIR, r"node_modules\.pnpm\electron@33.4.11\node_modules\electron\dist")
RELEASE_DIR = r"C:\Users\shann\OmniVeo-HQ\01_PROJECTS\Stratemark\Stratemark-win32-x64"
WEB_DIST = os.path.join(REPO_DIR, r"apps\web\dist")
DESKTOP_DIST = os.path.join(REPO_DIR, r"apps\desktop\dist")
ICON_ICO = os.path.join(REPO_DIR, r"apps\desktop\build\icon.ico")
DESKTOP_PATH = r"C:\Users\shann\Desktop"

exe_path = os.path.join(RELEASE_DIR, "Stratemark.exe")

if not os.path.exists(RELEASE_DIR) or not os.path.exists(exe_path):
    print("1. Copying Electron binary distribution...")
    os.makedirs(RELEASE_DIR, exist_ok=True)
    for item in os.listdir(ELECTRON_DIST):
        s = os.path.join(ELECTRON_DIST, item)
        d = os.path.join(RELEASE_DIR, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)
    electron_exe = os.path.join(RELEASE_DIR, "electron.exe")
    if os.path.exists(electron_exe):
        os.rename(electron_exe, exe_path)

print("2. Assembling application resources...")
resources_dir = os.path.join(RELEASE_DIR, "resources")
app_dir = os.path.join(resources_dir, "app")
os.makedirs(app_dir, exist_ok=True)

# Copy desktop bundle (main.mjs, preload.mjs)
dist_target = os.path.join(app_dir, "dist")
if os.path.exists(dist_target):
    shutil.rmtree(dist_target)
shutil.copytree(DESKTOP_DIST, dist_target)

# Copy web-dist to resources/web-dist
web_target = os.path.join(resources_dir, "web-dist")
if os.path.exists(web_target):
    shutil.rmtree(web_target)
shutil.copytree(WEB_DIST, web_target)

# Write app/package.json
package_json = """{
  "name": "stratemark",
  "productName": "Stratemark",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/main.mjs"
}"""
with open(os.path.join(app_dir, "package.json"), "w", encoding="utf-8") as f:
    f.write(package_json)

# Copy build icon to app
if os.path.exists(ICON_ICO):
    shutil.copy(ICON_ICO, os.path.join(RELEASE_DIR, "icon.ico"))

print("3. Creating Windows Desktop Shortcut and Launcher...")
vbs_script = f"""
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "{os.path.join(DESKTOP_PATH, 'Stratemark.lnk')}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "{exe_path}"
oLink.WorkingDirectory = "{RELEASE_DIR}"
oLink.Description = "Stratemark — Market Intelligence as a Collectible Deck"
oLink.IconLocation = "{os.path.join(RELEASE_DIR, 'icon.ico')}, 0"
oLink.Save
"""
vbs_path = os.path.join(RELEASE_DIR, "create_shortcut.vbs")
with open(vbs_path, "w", encoding="utf-8") as f:
    f.write(vbs_script)

subprocess.run(["cscript", "//Nologo", vbs_path], check=True)
os.remove(vbs_path)

bat_content = f"""@echo off
start "" "{exe_path}"
"""
with open(os.path.join(DESKTOP_PATH, "Launch Stratemark.bat"), "w", encoding="utf-8") as f:
    f.write(bat_content)

print(f"SUCCESS: Stratemark packaged into: {RELEASE_DIR}")
print(f"SUCCESS: Desktop shortcut created at: {os.path.join(DESKTOP_PATH, 'Stratemark.lnk')}")
