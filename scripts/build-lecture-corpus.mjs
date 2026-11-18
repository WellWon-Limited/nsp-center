// Optional: full lecture fragments for the consultation agent (scripts/ai-agent.mjs, AI_CORPUS_FILE). Reads the lecture
// transcripts (kept outside the repository, NSP_LECTURES_DIR, by default ~/.local/state/nsp-lectures/raw) and writes
// JSON lines {text, speaker, lecture, course, products} to NSP_CORPUS_OUT (by default
// ~/.local/state/nsp-center/lecture-corpus.jsonl) — also outside the repository. Lectures whose titles name a disease are
// left out, as for the expert comments. Without this file the agent uses the theme pages and expert comments only.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';

const root = process.env.NSP_LECTURES_DIR || join(homedir(), '.local/state/nsp-lectures/raw');
const out = process.env.NSP_CORPUS_OUT || join(homedir(), '.local/state/nsp-center/lecture-corpus.jsonl');
const content = JSON.parse(readFileSync(new URL('../packages/catalog/generated/content.json', import.meta.url), 'utf8'));
const riskyTitle = /(язв|covid|ковид|орви|аутоиммун|лечеб|лечени|болезн|заболеван|синдром|варикоз|гиперактив|диабет|онко|рак\b|гастрит|артрит|гипертон|инфекц|пульмонолог)/iu;
const names = content.products.map(p => ({ id: p.id, name: p.name.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase() })).filter(p => p.name.length >= 5);

const files = [];
const walk = dir => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.txt')) files.push(p); } };
walk(root);
const lines = [];
let kept = 0, skipped = 0;
for (const file of files) {
  const course = basename(dirname(file));
  const parts = readFileSync(file, 'utf8').split(/^=+\s*$/mu);
  for (let i = 0; i < parts.length; i++) {
    const head = parts[i].match(/РАЗДЕЛ:\s*(.*?)\s*\|\s*ЛЕКЦИЯ:\s*(.+)/u);
    if (!head) continue;
    const lecture = head[2].replace(/^\d+\s*/u, '').trim();
    const speaker = lecture.match(/\(([^)]+)\)\s*$/u)?.[1] ?? '';
    const body = (parts[i + 1] ?? '').replace(/\[Спикер \d+\]:\s*/gu, '').replace(/\s+/g, ' ').trim();
    if (!body) continue;
    if (riskyTitle.test(lecture)) { skipped++; continue; }
    kept++;
    const sentences = body.split(/(?<=[.!?])\s+/u);
    let chunk = '';
    const flush = () => { if (chunk.length > 200) { const low = chunk.toLowerCase(); lines.push(JSON.stringify({ text: chunk, speaker, lecture: lecture.replace(/\s*\([^)]+\)\s*$/u, ''), course, products: names.filter(n => low.includes(n.name)).map(n => n.id).slice(0, 4) })); } chunk = ''; };
    for (const s of sentences) { chunk = chunk ? `${chunk} ${s}` : s; if (chunk.length > 1000) flush(); }
    flush();
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n') + '\n');
console.log(`${lines.length} fragments from ${kept} lectures (${skipped} left out by title) -> ${out}`);
