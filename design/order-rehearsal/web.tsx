import '../../packages/presentation/styles';
import {finishSplash} from '../../packages/presentation/pwa';
import {createRoot} from 'react-dom/client';
import {App} from '../../apps/web/src/app';
import {StoreProvider} from '../../packages/presentation/store';
import {OrderConfirmation,type ConfirmedOrder} from '../../apps/web/src/order-confirmation';
import {SiteBackdrop} from '../../packages/presentation/ui';
const w=window as typeof window & {__qaUrl:string;__qaPageData:{order?:ConfirmedOrder};__qaHeader:string};
function OrderQA(){return <StoreProvider><SiteBackdrop/><div dangerouslySetInnerHTML={{__html:w.__qaHeader||''}}/><main className="site-main"><OrderConfirmation order={w.__qaPageData.order!}/></main></StoreProvider>}
createRoot(document.getElementById('root')!).render(w.__qaPageData?.order?<OrderQA/>:<App url={w.__qaUrl} pageData={{}}/>);
finishSplash();
