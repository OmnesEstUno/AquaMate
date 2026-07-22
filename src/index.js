import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/fonts.css';
import './styles/base.css';
import './styles/shared.css';
import './styles/gallery.css';
import './styles/species-page.css';
import App from './App.js';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

