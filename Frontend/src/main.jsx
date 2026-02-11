import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('Main.jsx loading...');
console.log('Root element:', document.getElementById('root'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<h1>ERROR: Root element not found!</h1>';
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('App rendered successfully');
}
