/**
 * Search indexing policy (docs/SEO.md, principle 6): only the production
 * domain may be indexed. Every other host — the dev stand, local servers,
 * previews — answers with a blocking robots.txt and X-Robots-Tag: noindex,
 * so a copy of the site never competes with nsp-center.ru in Yandex.
 */
export const PRODUCTION_HOSTS = new Set(['nsp-center.ru', 'www.nsp-center.ru']);

export const BLOCKED_ROBOTS = 'User-agent: *\nDisallow: /\n';

export const NOINDEX_HEADER = 'noindex, nofollow';

/** True only for the production domain; the Host header may carry a port. */
export function isIndexableHost(host) {
  const name = String(host ?? '').trim().toLowerCase().replace(/:\d+$/, '');
  return PRODUCTION_HOSTS.has(name);
}
