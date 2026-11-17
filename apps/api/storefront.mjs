import {readManagedCatalog,managedCategoryList,catalogAdminState} from './catalog-admin.mjs';
import {findCustomProduct,findContentArticle,contentArticlePaths,customRows} from './site-admin.mjs';
import {customProduct} from '../../packages/domain/custom-product.mjs';
import {visibleCategories} from '../../packages/domain/catalog-categories.mjs';
import {publicProduct} from '../../packages/domain/card-prices.mjs';

/** Public page data only. Staff prices and unpublished visibility do not grant access to staff APIs. */
export async function storefrontPage(pool,content,path){
  if(path.startsWith('/catalog/')){
    const config=await readManagedCatalog(pool,content.categories);
    const entry=config.categories.find(c=>c.path===path);
    if(!entry||config.revision===0)return {};
    if(entry.archived)return {redirect:entry.redirectTo||'/catalog/'};
    const state=await catalogAdminState(pool,content.categories,content.products);
    const category=state.categories.find(c=>c.path===path);
    return category?{category,categories:state.categories,products:state.products.filter(p=>!p.hidden).map(publicProduct)}:{};
  }
  if(path.startsWith('/product/')){
    const product=await findCustomProduct(pool,path.split('/')[2],await managedCategoryList(pool,content.categories));
    return product?{product:publicProduct(product)}:{};
  }
  if(path.startsWith('/blog/')){
    const article=await findContentArticle(pool,path.split('/')[2],new Map(content.products.map(p=>[p.id,p.path])));
    return article?{article}:{};
  }
  if(path==='/sitemap.xml'){
    const {rows}=await pool.query('select product_id, hidden from product_visibility');
    const hidden=new Set(rows.filter(r=>r.hidden).map(r=>r.product_id));
    const products=(await customRows(pool)).filter(r=>!hidden.has(r.product_id)).map(r=>customProduct(r.product_id,r.data,content.categories).path);
    const articles=await contentArticlePaths(pool);
    const state=await catalogAdminState(pool,content.categories,content.products);
    const categories=visibleCategories(state.categories,state.products).filter(c=>!content.categories.some(x=>x.path===c.path)).map(c=>c.path);
    return {paths:[...products,...articles,...categories]};
  }
  return {};
}
