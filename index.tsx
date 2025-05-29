
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx'; // Changed from './App'
import { GlobalWorkerOptions } from 'pdfjs-dist';

// Setup PDF.js worker. This is crucial for pdfjs-dist to work.
// Using cdn.jsdelivr.net for the worker.
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.2.133/build/pdf.worker.min.mjs`;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);