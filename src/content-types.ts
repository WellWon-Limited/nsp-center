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
};

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

export type Content = {
  products: Product[];
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
