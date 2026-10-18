import os
import base64

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
avatar_dir = os.path.join(base_dir, 'music', 'static', 'music', 'images', 'avatars')
png_path = os.path.join(avatar_dir, 'default-avatar.png')
svg_path = os.path.join(avatar_dir, 'default-avatar.svg')

with open(png_path, 'rb') as f:
    b64_data = base64.b64encode(f.read()).decode('utf-8')

svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <clipPath id="circleClip">
      <circle cx="256" cy="256" r="256" />
    </clipPath>
    <radialGradient id="avatarGlow" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#8b5cf6" stop-opacity="0" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.6" />
    </radialGradient>
  </defs>
  <g clip-path="url(#circleClip)">
    <image href="data:image/png;base64,{b64_data}" width="512" height="512" preserveAspectRatio="xMidYMid slice" />
    <circle cx="256" cy="256" r="254" fill="url(#avatarGlow)" />
    <circle cx="256" cy="256" r="253" fill="none" stroke="rgba(56, 189, 248, 0.4)" stroke-width="4" />
  </g>
</svg>"""

with open(svg_path, 'w', encoding='utf-8') as f:
    f.write(svg_content)

print(f"Successfully generated {svg_path}, size: {len(svg_content)} bytes")
