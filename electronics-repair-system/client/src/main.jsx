import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const rootElement = document.getElementById('root');

const showFatalError = (error) => {
  console.error('Критична помилка застосунку:', error);
  rootElement.innerHTML = `
    <div class="page-error">
      <h2>Застосунок не вдалося завантажити</h2>
      <p>Оновіть сторінку. Якщо помилка повториться, відкрийте консоль браузера і скопіюйте текст помилки.</p>
      <button type="button" onclick="window.location.reload()">Оновити сторінку</button>
    </div>
  `;
};

window.addEventListener('error', (event) => showFatalError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  showFatalError(error);
}
