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

print("1. Cleaning old release folder...")
if os.path.exists(RELEASE_DIR):
    shutil.rmtree(RELEASE_DIR)

print("2. Copying Electron binary distribution...")
shutil.copytree(ELECTRON_DIST, RELEASE_DIR)

# Rename electron.exe to Stratemark.exe
exe_path = os.path.join(RELEASE_DIR, "Stratemark.exe")
os.rename(os.path.join(RELEASE_DIR, "electron.exe"), exe_path)

print("3. Assembling application resources...")
resources_dir = os.path.join(RELEASE_DIR, "resources")
app_dir = os.path.join(resources_dir, "app")
os.makedirs(app_dir, exist_ok=True)

# Copy desktop bundle (main.mjs, preload.mjs)
shutil.copytree(DESKTOP_DIST, os.path.join(app_dir, "dist"))

# Copy web-dist to resources/web-dist
shutil.copytree(WEB_DIST, os.path.join(resources_dir, "web-dist"))

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
shutil.copy(ICON_ICO, os.path.join(RELEASE_DIR, "icon.ico"))

print("4. Creating Windows Desktop Shortcut and Launcher...")
# Create VBScript to make Windows Shortcut (.lnk)
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

# Also create Launch Stratemark.bat on Desktop
bat_content = f"""@echo off
start "" "{exe_path}"
"""
with open(os.path.join(DESKTOP_PATH, "Launch Stratemark.bat"), "w", encoding="utf-8") as f:
    f.write(bat_content)

print(f"SUCCESS: Stratemark packaged into: {RELEASE_DIR}")
print(f"SUCCESS: Desktop shortcut created at: {os.path.join(DESKTOP_PATH, 'Stratemark.lnk')}")
