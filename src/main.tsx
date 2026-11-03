import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import './design-system.css';
import './app.css';
const root=document.getElementById('root')!;
const url=location.pathname+location.search;
const pageData=JSON.parse(document.getElementById('nsp-page-data')?.textContent||'{}');
if(root.hasChildNodes()&&root.dataset.route===url)hydrateRoot(root,<App url={url} pageData={pageData}/>);else createRoot(root).render(<App url={url} pageData={pageData}/>);
