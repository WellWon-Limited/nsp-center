import { readdirSync, readFileSync } from 'node:fs';

// Rewritten product texts (src/product-copy/<product id>.json): a clear "about" in plain
// paragraphs plus short highlights, written from the product's own card but without the
// snapshot's treatment claims. Products without a file keep the snapshot description.
export const productCopyDirUrl = new URL('../src/product-copy/', import.meta.url);

export function readProductCopy() {
  const copy = new Map();
  for (const name of readdirSync(productCopyDirUrl).filter(n => n.endsWith('.json')).sort()) {
    const entry = JSON.parse(readFileSync(new URL(name, productCopyDirUrl), 'utf8'));
    if (`${entry.id}.json` !== name) throw new Error(`Product copy ${name}: id must match the file name`);
    if (!Array.isArray(entry.about) || !entry.about.length) throw new Error(`Product copy ${name}: "about" paragraphs are required`);
    copy.set(entry.id, { about: entry.about, highlights: entry.highlights ?? [] });
  }
  return copy;
}
