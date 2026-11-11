import { existsSync, readdirSync, readFileSync } from 'node:fs';

// Expert comments from the doctors' lecture base (src/product-experts/<product id>.json): what a named speaker says
// about the product in a lecture, retold briefly and without treatment claims. They open the product's «Отзывы» tab,
// marked «Отзыв эксперта», above customer reviews. The lecture base itself stays outside the repository.
export const productExpertsDirUrl = new URL('../src/product-experts/', import.meta.url);

export function readProductExperts() {
  const experts = new Map();
  if (!existsSync(productExpertsDirUrl)) return experts;
  for (const name of readdirSync(productExpertsDirUrl).filter(n => n.endsWith('.json')).sort()) {
    const entry = JSON.parse(readFileSync(new URL(name, productExpertsDirUrl), 'utf8'));
    if (`${entry.id}.json` !== name) throw new Error(`Product experts ${name}: id must match the file name`);
    const notes = (entry.notes ?? []).map(note => ({ speaker: String(note.speaker ?? '').trim(), role: String(note.role ?? '').trim(), course: String(note.course ?? '').trim(), lecture: String(note.lecture ?? '').trim(), text: String(note.text ?? '').trim() }));
    for (const note of notes) if (!note.speaker || !note.lecture || !note.text) throw new Error(`Product experts ${name}: every note needs speaker, lecture and text`);
    if (notes.length) experts.set(entry.id, notes);
  }
  return experts;
}

// What a product set («Набор …») contains (src/set-contents.json: set id -> product ids, read from the set's photo).
// A set has no lecture comments of its own; its «Отзывы» tab shows one comment on each product inside it, marked with
// the product it is about (`about`).
export const setContentsUrl = new URL('../src/set-contents.json', import.meta.url);
export function readSetContents() {
  if (!existsSync(setContentsUrl)) return new Map();
  return new Map(Object.entries(JSON.parse(readFileSync(setContentsUrl, 'utf8'))).map(([id, ids]) => [id, ids]));
}
