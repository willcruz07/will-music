// Gera os ícones do PWA, o favicon e o logo otimizado a partir das artes originais desta pasta.
// Rodar com: node apps/web/brand/generate.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const out = (p) => here(`../public/${p}`);
const mark = here('favicon.png');
const logo = here('logo.png');

// O quadrado arredondado do símbolo ocupa ~812 px no centro (624, 601) da arte de 1254 px.
const crop = (side) => ({ left: Math.round(624 - side / 2), top: Math.round(601 - side / 2), width: side, height: side });
const png = (img) => img.png({ compressionLevel: 9, palette: true, quality: 95, effort: 10, dither: 0.6 });

await png(sharp(mark).extract(crop(900)).resize(192)).toFile(out('icons/icon-192.png'));
await png(sharp(mark).extract(crop(900)).resize(512)).toFile(out('icons/icon-512.png'));
// Maskable: a arte inteira, com o símbolo dentro da área segura de 80% (o sistema recorta as bordas).
await png(sharp(mark).resize(512)).toFile(out('icons/icon-maskable-512.png'));
await png(sharp(mark).extract(crop(900)).resize(180)).toFile(out('icons/apple-touch-icon.png'));
await png(sharp(mark).extract(crop(840)).resize(48)).toFile(out('icons/favicon-48.png'));
// Símbolo do cabeçalho (mostrado a 32 px; 96 px cobre telas 3x).
await png(sharp(mark).extract(crop(840)).resize(96)).toFile(out('icons/mark-96.png'));
// Logo completo, para telas de apresentação.
await sharp(logo).resize(640).webp({ quality: 88 }).toFile(out('logo.webp'));
console.log('ok');
