import fs from 'fs';
import path from 'path';
import { Jimp } from 'jimp';

async function generatePngIcons() {
  const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512];
  const uiDir = path.resolve('src/routes/ui');

  for (const size of sizes) {
    const image = new Jimp({ width: size, height: size, color: 0x00a884ff });

    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    const r = Math.floor(size * 0.35);

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= r && dist >= r - Math.max(1, Math.floor(size * 0.08))) {
          image.setPixelColor(0xffffffff, x, y);
        }
        const cornerDist = Math.max(
          Math.abs(x - cx) - (size / 2 - size * 0.2),
          Math.abs(y - cy) - (size / 2 - size * 0.2),
          0
        );
        if (cornerDist > size * 0.2) {
          image.setPixelColor(0x00000000, x, y);
        }
      }
    }

    const outPath = path.join(uiDir, `icon-${size}.png`);
    const buffer = await image.getBuffer('image/png');
    fs.writeFileSync(outPath, buffer);
  }
  console.log('✅ Generated PNG icon set successfully');
}

generatePngIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});

