// Gera os ícones do PWA, o favicon e o logo otimizado a partir das artes originais desta pasta.
// Rodar com: node apps/web/brand/generate.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const out = (p) => here(`../public/${p}`);
const mark = here('favicon.png');
const logo = here('logo.png');

// O quadrado arredondado do símbolo ocupa ~1110 px no centro (623, 620) da arte de 1254 px.
const CENTER = { x: 623, y: 620 };
const BACKDROP = { r: 0, g: 8, b: 19 };
const crop = (side) => ({ left: Math.round(CENTER.x - side / 2), top: Math.round(CENTER.y - side / 2), width: side, height: side });
const png = (img) => img.png({ compressionLevel: 9, palette: true, quality: 95, effort: 10, dither: 0.6 });

await png(sharp(mark).extract(crop(1180)).resize(192)).toFile(out('icons/icon-192.png'));
await png(sharp(mark).extract(crop(1180)).resize(512)).toFile(out('icons/icon-512.png'));
// Maskable: o símbolo reduzido dentro da área segura de 80%, com o fundo da arte em volta (o sistema recorta as bordas).
await png(
  sharp(mark).extract(crop(1180)).resize(400).extend({ top: 56, bottom: 56, left: 56, right: 56, background: BACKDROP }),
).toFile(out('icons/icon-maskable-512.png'));
await png(sharp(mark).extract(crop(1180)).resize(180)).toFile(out('icons/apple-touch-icon.png'));
await png(sharp(mark).extract(crop(1130)).resize(48)).toFile(out('icons/favicon-48.png'));
// Símbolo do cabeçalho (mostrado a 32 px; 96 px cobre telas 3x).
await png(sharp(mark).extract(crop(1130)).resize(96)).toFile(out('icons/mark-96.png'));
// Logo completo, para telas de apresentação.
await sharp(logo).resize(640).webp({ quality: 88 }).toFile(out('logo.webp'));
console.log('ok');
