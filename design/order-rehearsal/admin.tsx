import '../../packages/presentation/styles';
import {createRoot} from 'react-dom/client';
import {AdminApp} from '../../apps/admin/admin';
import {AdminStoreProvider} from '../../apps/admin/store';
createRoot(document.getElementById('root')!).render(<AdminStoreProvider><AdminApp/></AdminStoreProvider>);
