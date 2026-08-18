import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

def create_inviting_icon(size=512):
    # Create high-res canvas (1024x1024 for supersampling)
    scale = 2
    canvas_size = size * scale
    img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 48 * scale
    box = [margin, margin, canvas_size - margin, canvas_size - margin]
    corner_radius = 115 * scale

    # 1. Soft Shadow Layer
    shadow = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    shadow_offset = 20 * scale
    s_box = [margin, margin + shadow_offset, canvas_size - margin, canvas_size - margin + shadow_offset]
    s_draw.rounded_rectangle(s_box, radius=corner_radius, fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=28 * scale))
    img = Image.alpha_composite(img, shadow)

    # 2. Main Squircle Body with Radial/Linear Gradient
    body = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(body)

    # Draw gradient inside rounded rectangle
    mask = Image.new('L', (canvas_size, canvas_size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle(box, radius=corner_radius, fill=255)

    # Gradient from top-left (rich vibrant teal-emerald) to bottom-right (deep midnight slate)
    grad = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grad)

    for y in range(canvas_size):
        ratio = y / canvas_size
        # Warm inviting gradient: Emerald/Teal (#0D3B3F -> #0B192C)
        r = int(11 + ratio * (7 - 11))
        g = int(58 - ratio * 32)
        b = int(62 - ratio * 18)
        g_draw.line([(0, y), (canvas_size, y)], fill=(r, g, b, 255))

    body = Image.composite(grad, body, mask)

    # 3. Inner Radial Ambient Glow
    glow = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    gl_draw = ImageDraw.Draw(glow)
    gl_center = (int(canvas_size * 0.45), int(canvas_size * 0.4))
    gl_radius = int(canvas_size * 0.45)
    for r_step in range(gl_radius, 0, -2):
        alpha = int((1.0 - (r_step / gl_radius)) * 75)
        gl_draw.ellipse(
            [gl_center[0] - r_step, gl_center[1] - r_step, gl_center[0] + r_step, gl_center[1] + r_step],
            fill=(45, 212, 191, alpha)
        )
    glow = Image.composite(glow, Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0)), mask)
    body = Image.alpha_composite(body, glow)

    # 4. Subtle Inner Border / Glass Highlight
    b_draw = ImageDraw.Draw(body)
    b_draw.rounded_rectangle(box, radius=corner_radius, outline=(45, 212, 191, 100), width=3 * scale)

    img = Image.alpha_composite(img, body)

    # 5. Render the Stratemark "S" Emblem in Crisp Vector Geometry
    emblem = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    e_draw = ImageDraw.Draw(emblem)

    # Calculate emblem coordinates centered on canvas
    cx, cy = canvas_size / 2, canvas_size / 2
    emblem_w = 340 * scale
    emblem_h = 370 * scale
    
    # Top ribbon polygon / path
    top_ribbon = [
        (cx - 90*scale, cy - 140*scale),
        (cx + 95*scale, cy - 140*scale),
        (cx + 130*scale, cy - 130*scale),
        (cx + 135*scale, cy - 105*scale),
        (cx - 30*scale,  cy + 35*scale),
        (cx - 75*scale,  cy + 45*scale),
        (cx - 135*scale, cy + 35*scale),
        (cx - 140*scale, cy - 35*scale),
        (cx - 120*scale, cy - 90*scale),
        (cx - 40*scale,  cy - 135*scale),
    ]

    # Bottom ribbon polygon / path
    bot_ribbon = [
        (cx + 90*scale, cy + 140*scale),
        (cx - 95*scale, cy + 140*scale),
        (cx - 130*scale, cy + 130*scale),
        (cx - 135*scale, cy + 105*scale),
        (cx + 30*scale,  cy - 35*scale),
        (cx + 75*scale,  cy - 45*scale),
        (cx + 135*scale, cy - 35*scale),
        (cx + 140*scale, cy + 35*scale),
        (cx + 120*scale, cy + 90*scale),
        (cx + 40*scale,  cy + 135*scale),
    ]

    # Draw Ribbon drop shadow
    emb_shadow = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    es_draw = ImageDraw.Draw(emb_shadow)
    es_draw.polygon(top_ribbon, fill=(0, 0, 0, 110))
    es_draw.polygon(bot_ribbon, fill=(0, 0, 0, 110))
    emb_shadow = emb_shadow.filter(ImageFilter.GaussianBlur(radius=8 * scale))
    img = Image.alpha_composite(img, emb_shadow)

    # Top Ribbon (Vibrant gradient: Mint to Teal)
    top_mask = Image.new('L', (canvas_size, canvas_size), 0)
    tm_draw = ImageDraw.Draw(top_mask)
    tm_draw.polygon(top_ribbon, fill=255)

    top_grad = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    tg_draw = ImageDraw.Draw(top_grad)
    for y in range(int(cy - 160*scale), int(cy + 60*scale)):
        t_ratio = (y - (cy - 160*scale)) / (220*scale)
        r = int(28 + t_ratio * (15 - 28))
        g = int(220 - t_ratio * (160 - 220))
        b = int(205 - t_ratio * (180 - 205))
        tg_draw.line([(0, y), (canvas_size, y)], fill=(r, g, b, 255))
    top_piece = Image.composite(top_grad, Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0)), top_mask)

    # Bottom Ribbon (Vibrant gradient: Teal to Emerald)
    bot_mask = Image.new('L', (canvas_size, canvas_size), 0)
    bm_draw = ImageDraw.Draw(bot_mask)
    bm_draw.polygon(bot_ribbon, fill=255)

    bot_grad = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bot_grad)
    for y in range(int(cy - 60*scale), int(cy + 160*scale)):
        b_ratio = (y - (cy - 60*scale)) / (220*scale)
        r = int(15 + b_ratio * (45 - 15))
        g = int(180 + b_ratio * (212 - 180))
        b = int(170 + b_ratio * (191 - 170))
        bg_draw.line([(0, y), (canvas_size, y)], fill=(r, g, b, 255))
    bot_piece = Image.composite(bot_grad, Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0)), bot_mask)

    # Combine pieces
    img = Image.alpha_composite(img, top_piece)
    img = Image.alpha_composite(img, bot_piece)

    # Outline ribbons with fine specular stroke
    em_stroke = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    st_draw = ImageDraw.Draw(em_stroke)
    st_draw.polygon(top_ribbon, outline=(255, 255, 255, 140), width=max(1, int(1.5 * scale)))
    st_draw.polygon(bot_ribbon, outline=(255, 255, 255, 140), width=max(1, int(1.5 * scale)))
    img = Image.alpha_composite(img, em_stroke)

    # Downsample with high-quality Lanczos filter
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

if __name__ == '__main__':
    repo_dir = r"C:\Users\shann\OmniVeo-HQ\01_PROJECTS\Stratemark\repo"
    desktop_build_dir = os.path.join(repo_dir, r"apps\desktop\build")
    web_public_dir = os.path.join(repo_dir, r"apps\web\public")
    os.makedirs(desktop_build_dir, exist_ok=True)
    os.makedirs(web_public_dir, exist_ok=True)

    icon_512 = create_inviting_icon(512)
    png_path = os.path.join(desktop_build_dir, "icon.png")
    icon_512.save(png_path, "PNG")
    print(f"Generated PNG: {png_path}")

    # Also copy to web public
    web_png_path = os.path.join(web_public_dir, "icon.png")
    icon_512.save(web_png_path, "PNG")

    # Generate multi-size ICO
    ico_path = os.path.join(desktop_build_dir, "icon.ico")
    icon_512.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    print(f"Generated Multi-Size ICO: {ico_path}")

    web_ico_path = os.path.join(web_public_dir, "favicon.ico")
    icon_512.save(
        web_ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print("All icons successfully generated!")
