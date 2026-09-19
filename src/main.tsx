import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const root = document.getElementById('root')!;
// Drop the inline boot splash from index.html before React takes the node over.
document.getElementById('boot')?.remove();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
