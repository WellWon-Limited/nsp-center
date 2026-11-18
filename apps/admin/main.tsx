import '../../packages/presentation/styles';
import {createRoot} from 'react-dom/client';
import {AdminApp} from './admin';
import {AdminStoreProvider} from './store';
createRoot(document.getElementById('root')!).render(<AdminStoreProvider><AdminApp/></AdminStoreProvider>);
