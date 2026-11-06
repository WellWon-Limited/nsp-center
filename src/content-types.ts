export type Breadcrumb = { name: string; url: string | null };
export type DocumentLink = { name: string; size: string; url: string | null };
export type SiteLink = { text: string | null; url: string };

/** Retail is for everyone; partner is for discount-card holders (null when the price list lacks the product). */
export type ProductPrices = { retail: number; partner: number | null; source: 'price-list' | 'snapshot' };

export type Product = {
  id: string;
  path: string;
  url: string;
  name: string;
  article: string | null;
  price: number | null;
  price_base: number | null;
  discount: string | null;
  currency: string | null;
  availability: string | null;
  availability_text: string | null;
  brand: string | null;
  category: string | null;
  categoryPath: string | null;
  breadcrumbs: Breadcrumb[];
  rating: number | null;
  review_count: number | null;
  properties: Record<string, string>;
  sections: Record<string, string>;
  sectionsHtml: Record<string, string>;
  description: string;
  descriptionHtml: string;
  image: string | null;
  images: string[];
  documents: DocumentLink[];
  microdata_outside_product: string[];
  related: string[];
  prices: ProductPrices;
  /** Rewritten text from src/product-copy (only on the product's own page, not in the browser summary). */
  copy?: ProductCopy; experts?: ExpertNote[];
};

export type ProductCopy = { about: string[]; highlights: string[] };
/** An expert comment from the doctors' lecture base (scripts/product-experts.mjs). */
export type ExpertNote = { speaker: string; role: string; course: string; lecture: string; text: string };

export type Category = {
  id: string;
  path: string;
  url: string;
  name: string;
  description: string | null;
  html: string;
  breadcrumbs: Breadcrumb[];
  parent: string | null;
  children: string[];
  products: string[];
  pagination: string[];
};

export type Article = {
  id: string;
  path: string;
  url: string;
  title: string;
  date: string | null;
  description: string | null;
  image: string | null;
  images: string[];
  html: string;
  body: string;
  related: string[];
  source: { raw: string; markdown: string };
};

export type ContentPage = {
  id: string;
  path: string;
  url: string;
  title: string;
  description: string | null;
  html: string;
  body: string;
  media: string[];
  emptySource: boolean;
  source: { raw: string; markdown: string };
};

export type Route = {
  path: string;
  url: string;
  type: 'home' | 'category' | 'product' | 'blog' | 'article' | 'page';
  id: string;
  title: string;
  sourceUrl: string;
  canonicalPath: string;
  page?: number;
  products?: string[];
};

export type ThemePair = { productId: string; why: string };
export type ThemeSection = { heading: string; paragraphs: string[] };
export type ThemeFaq = { question: string; answer: string };
export type ThemeSource = { course: string; lecture: string; speaker?: string };
/** Thematic sales page (src/theme-data/<slug>.json); the browser summary carries only ThemeIndex. */
export type Theme = {
  slug: string; path: string;
  /** <title> without the site suffix; carries the main search query. */
  title: string; description: string; h1: string; lead: string;
  mainProductId: string; pairs: ThemePair[]; sections: ThemeSection[]; faq: ThemeFaq[]; sources: ThemeSource[];
  /** Specialist who checked the text; null until the owner names one. */
  reviewedBy: string | null; updated: string;
};
export type ThemeIndex = Pick<Theme, 'slug' | 'path' | 'title' | 'description' | 'h1' | 'mainProductId'>;

export type Content = {
  products: Product[];
  themes: ThemeIndex[];
  categories: Category[];
  articles: Article[];
  pages: ContentPage[];
  site: {
    title: string;
    logo: string | null;
    phones: string[];
    emails: string[];
    external_links: string[];
    header_text: string;
    header_links: SiteLink[];
    footer_text: string;
    footer_links: SiteLink[];
    address: string;
    homeHtml: string;
    homeMedia: string[];
  };
  routes: Route[];
  redirects: Record<string, string>;
  audit: {
    source: Record<string, unknown>;
    sourcePages: number;
    routeCount: number;
    copiedMedia: number;
    externalMedia: string[];
    unavailableDecorativeMedia: { url: string; reason: string }[];
    unresolvedInternalLinks: { url: string; reason: string }[];
    emptySourcePages: string[];
    sourceContent: { path: string; characters: number; media: number }[];
  };
};
