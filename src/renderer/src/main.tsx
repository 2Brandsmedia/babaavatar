import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

console.log('[BabaAvatar] Renderer-Bootstrap gestartet');

window.addEventListener('error', (event) => {
  console.error('[BabaAvatar] Window-Error:', event.message, event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[BabaAvatar] Unhandled Rejection:', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root-Element nicht gefunden');
}

try {
  console.log('[BabaAvatar] Erstelle React-Root');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log('[BabaAvatar] React-Render aufgerufen');
} catch (err) {
  console.error('[BabaAvatar] React-Bootstrap fehlgeschlagen:', err);
  rootElement.innerHTML = `<pre style="color:#ff6b6b;padding:20px;white-space:pre-wrap;font-family:ui-monospace,monospace;">${
    err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err)
  }</pre>`;
}
