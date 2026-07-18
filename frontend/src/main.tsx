import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './config/env';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
