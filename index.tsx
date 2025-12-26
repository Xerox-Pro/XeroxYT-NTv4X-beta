
import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Use HashRouter for GAS compatibility (no server-side routing fallback)
import { HashRouter } from 'react-router-dom';
import App from './App';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { PlaylistProvider } from './contexts/PlaylistContext';
import { SearchHistoryProvider } from './contexts/SearchHistoryContext';
import { HistoryProvider } from './contexts/HistoryContext';
import { PreferenceProvider } from './contexts/PreferenceContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './hooks/useTheme';
import './styles.css'; // Import styles for bundling

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <PreferenceProvider>
            <SubscriptionProvider>
              <PlaylistProvider>
                <SearchHistoryProvider>
                  <HistoryProvider>
                    <NotificationProvider>
                      <App />
                    </NotificationProvider>
                  </HistoryProvider>
                </SearchHistoryProvider>
              </PlaylistProvider>
            </SubscriptionProvider>
          </PreferenceProvider>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
);
