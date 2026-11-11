import { readdirSync, readFileSync } from 'node:fs';

// Thematic sales pages (/temy/<slug>/): one JSON file per theme in src/theme-data/.
// The import puts the full themes into content.json (prerender) and a light index into
// the browser summary, so a page ships only its own theme text (via its page data).
export const themeDirUrl = new URL('../src/theme-data/', import.meta.url);
const required = ['slug', 'path', 'title', 'description', 'h1', 'lead', 'mainProductId', 'pairs', 'sections', 'faq', 'sources', 'updated'];

export function readThemes() {
  return readdirSync(themeDirUrl).filter(name => name.endsWith('.json')).sort().map(name => {
    const theme = JSON.parse(readFileSync(new URL(name, themeDirUrl), 'utf8'));
    for (const key of required) if (!(key in theme)) throw new Error(`Theme ${name}: missing ${key}`);
    if (`${theme.slug}.json` !== name) throw new Error(`Theme ${name}: slug must match the file name`);
    return { reviewedBy: null, ...theme };
  });
}

export const themeIndex = theme => ({ slug: theme.slug, path: theme.path, title: theme.title, description: theme.description, h1: theme.h1, mainProductId: theme.mainProductId });
