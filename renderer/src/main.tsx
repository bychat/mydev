import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BackendProvider } from './context/BackendContext';
import App from './App';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackendProvider>
      <App />
    </BackendProvider>
  </StrictMode>
);
