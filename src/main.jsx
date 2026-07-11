import React from 'react';
import ReactDOM from 'react-dom/client';
import './storageShim'; // 必须在 App/PrepTracker 之前导入，先把 window.storage 挂好
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
