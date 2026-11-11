// Thematic sales pages: a page answers one search question ("для чего нужен витамин D3")
// and leads to the main product plus the products taken together with it. Texts live in
// src/theme-data/<slug>.json (scripts/themes.mjs), grounded in the doctors' lecture base and
// phrased as support, never as treatment (Russian BAD advertising law, docs/SEO.md principle 4).
// The browser only has the index below; a page gets its full theme through its page data.
import type { ThemeIndex } from './content-types';
import { data } from './store';

export type { Theme, ThemeFaq, ThemeIndex, ThemePair, ThemeSection, ThemeSource } from './content-types';

export const themes: ThemeIndex[] = data.themes ?? [];
export const themeByPath = (path: string) => themes.find(theme => theme.path === path);
