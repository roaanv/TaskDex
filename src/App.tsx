// App.tsx — TaskDex root. Tree: ThemeProvider (theme state owned at the root so
// the whole tree re-renders on change) → StoreProvider (data store) → Shell.

import { ThemeProvider } from './theme/ThemeContext';
import { StoreProvider } from './store/StoreContext';
import { Shell } from './components/Shell';

export default function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ThemeProvider>
  );
}
