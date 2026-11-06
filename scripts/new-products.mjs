import { readdirSync, readFileSync } from 'node:fs';
import { pricesFor } from './pricing.mjs';

// Products added to the catalog after the nsp-center.ru snapshot (src/product-new/<id>.json): the label facts, a
// rewritten description and an image under public/images/products. They are appended after the snapshot import (its
// completeness checks stay about the snapshot) and shown first in their category, priced from the NSP price list.
export const newProductsDirUrl = new URL('../src/product-new/', import.meta.url);

export function readNewProducts(priceList, categories) {
  const products = [];
  for (const name of readdirSync(newProductsDirUrl).filter(n => n.endsWith('.json')).sort()) {
    const entry = JSON.parse(readFileSync(new URL(name, newProductsDirUrl), 'utf8'));
    if (`${entry.id}.json` !== name) throw new Error(`New product ${name}: id must match the file name`);
    for (const key of ['name', 'article', 'category', 'image']) if (!entry[key]) throw new Error(`New product ${name}: "${key}" is required`);
    if (!priceList.items[entry.article]) throw new Error(`New product ${name}: article ${entry.article} is not in the price list`);
    const category = categories.find(c => c.name === entry.category);
    if (!category) throw new Error(`New product ${name}: unknown category ${entry.category}`);
    const path = `/product/${entry.id}/`;
    const prices = pricesFor(entry, priceList);
    products.push({
      url: path, path, id: entry.id, name: entry.name, article: entry.article,
      price: prices.retail, price_base: prices.retail, discount: '', currency: 'RUB',
      availability: 'InStock', availability_text: 'В наличии', brand: null,
      category: category.name, categoryPath: category.path,
      breadcrumbs: [{ name: 'Главная', url: '/' }, { name: category.name, url: category.path }, { name: entry.name, url: null }],
      rating: null, review_count: 0,
      properties: { ...entry.properties, pv: String(priceList.items[entry.article].pv).replace('.', ',') },
      documents: [], images: [entry.image], image: entry.image, microdata_outside_product: [], related: [],
      sections: {}, sectionsHtml: {}, description: entry.copy?.about?.join(' ') ?? '', descriptionHtml: '',
      prices, copy: entry.copy, added: true,
    });
  }
  return products;
}
