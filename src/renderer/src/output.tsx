import React from 'react';
import ReactDOM from 'react-dom/client';
import { OutputApp } from './output/OutputApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root-Element nicht gefunden');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <OutputApp />
  </React.StrictMode>,
);
