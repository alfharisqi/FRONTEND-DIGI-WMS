import React from 'react';
import ReactDOM from 'react-dom/client';
import 'driver.js/dist/driver.css';
import { Toaster } from 'sonner';
import { ThemeProvider } from './context/ThemeProvider';
import { LayoutProvider } from './context/LayoutProvider';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light">
      <LayoutProvider>
        <App />
        <Toaster richColors position="bottom-right" />
      </LayoutProvider>
    </ThemeProvider>
  </React.StrictMode>
);
