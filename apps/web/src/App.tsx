import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './routes';

// HashRouter keeps deep links working under Electron's file:// origin (Electron-ready),
// and avoids the data-router fetch/Request machinery we don't need (no loaders/actions).
export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
