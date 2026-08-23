import os
import markdown
import subprocess

MD_PATH = r"C:\Users\shann\OmniVeo-HQ\01_PROJECTS\Stratemark\STRATEMARK-MULTI-AGENT-BACKEND-SPEC.md"
HTML_PATH = r"C:\Users\shann\OmniVeo-HQ\01_PROJECTS\Stratemark\audit_artifacts\spec_printable.html"
PDF_PATH = r"C:\Users\shann\OmniVeo-HQ\01_PROJECTS\Stratemark\STRATEMARK-MULTI-AGENT-BACKEND-SPEC.pdf"
DESKTOP_ONEDRIVE = r"C:\Users\shann\OneDrive\Desktop\STRATEMARK-MULTI-AGENT-BACKEND-SPEC.pdf"
DESKTOP_LOCAL = r"C:\Users\shann\Desktop\STRATEMARK-MULTI-AGENT-BACKEND-SPEC.pdf"

with open(MD_PATH, "r", encoding="utf-8") as f:
    md_content = f.read()

html_body = markdown.markdown(md_content, extensions=['tables', 'fenced_code'])

full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Stratemark Multi-Agent Backend Architecture Specification</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Parkinsans:wght@600;700&display=swap');

  @page {{
    size: A4;
    margin: 20mm 18mm 20mm 18mm;
    @bottom-right {{
      content: counter(page);
      font-size: 9pt;
      font-family: 'Google Sans Flex', sans-serif;
      color: #64748B;
    }}
  }}

  body {{
    font-family: 'Google Sans Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1E293B;
    line-height: 1.6;
    font-size: 10.5pt;
    background: #FFFFFF;
    margin: 0;
    padding: 0;
  }}

  h1 {{
    font-family: 'Parkinsans', sans-serif;
    color: #0F172A;
    font-size: 22pt;
    font-weight: 700;
    border-bottom: 2px solid #0F766E;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 12px;
  }}

  h2 {{
    font-family: 'Parkinsans', sans-serif;
    color: #0F766E;
    font-size: 14pt;
    font-weight: 700;
    margin-top: 24px;
    margin-bottom: 10px;
    border-bottom: 1px solid #E2E8F0;
    padding-bottom: 4px;
    page-break-after: avoid;
  }}

  h3 {{
    font-family: 'Google Sans Flex', sans-serif;
    color: #1E293B;
    font-size: 12pt;
    font-weight: 600;
    margin-top: 16px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }}

  p, li {{
    color: #334155;
  }}

  ul, ol {{
    padding-left: 22px;
    margin-top: 6px;
    margin-bottom: 12px;
  }}

  li {{
    margin-bottom: 4px;
  }}

  code {{
    font-family: 'JetBrains Mono', monospace;
    font-size: 9pt;
    background: #F1F5F9;
    padding: 2px 5px;
    border-radius: 4px;
    color: #0F766E;
  }}

  pre {{
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5pt;
    background: #0F172A;
    color: #F8FAFC;
    padding: 12px 14px;
    border-radius: 8px;
    overflow-x: auto;
    line-height: 1.45;
    margin: 12px 0;
    page-break-inside: avoid;
  }}

  pre code {{
    background: transparent;
    color: #F8FAFC;
    padding: 0;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }}

  th, td {{
    border: 1px solid #CBD5E1;
    padding: 8px 10px;
    text-align: left;
  }}

  th {{
    background: #F8FAFC;
    color: #0F172A;
    font-weight: 600;
  }}

  tr:nth-child(even) {{
    background: #F8FAFC;
  }}

  blockquote {{
    border-left: 4px solid #0F766E;
    margin: 12px 0;
    padding: 8px 14px;
    background: #F0FDFA;
    color: #0F766E;
    font-style: italic;
  }}

  hr {{
    border: 0;
    height: 1px;
    background: #E2E8F0;
    margin: 20px 0;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""

os.makedirs(os.path.dirname(HTML_PATH), exist_ok=True)
with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(full_html)

print("HTML template generated. Invoking Playwright to render PDF...")

render_js = f"""
const {{ chromium }} = require('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/node_modules/@playwright/test');
const path = require('path');

(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + {repr(HTML_PATH)}.replace(/\\\\/g, '/'), {{ waitUntil: 'networkidle' }});
  await page.pdf({{
    path: {repr(PDF_PATH)},
    format: 'A4',
    margin: {{ top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' }},
    printBackground: true,
  }});
  await browser.close();
  console.log('PDF rendered successfully to:', {repr(PDF_PATH)});
}})();
"""

js_path = r"C:\Users\shann\OmniVeo-HQ\01_PROJECTS\Stratemark\audit_artifacts\render_pdf.cjs"
with open(js_path, "w", encoding="utf-8") as f:
    f.write(render_js)

subprocess.run(["node", js_path], check=True)
os.remove(js_path)

# Copy to Desktop locations
if os.path.exists(r"C:\Users\shann\OneDrive\Desktop"):
    import shutil
    shutil.copy(PDF_PATH, DESKTOP_ONEDRIVE)
    print(f"Copied to Desktop: {DESKTOP_ONEDRIVE}")

if os.path.exists(r"C:\Users\shann\Desktop"):
    import shutil
    shutil.copy(PDF_PATH, DESKTOP_LOCAL)
    print(f"Copied to Desktop: {DESKTOP_LOCAL}")

print("SUCCESS: High-quality PDF generated successfully!")
