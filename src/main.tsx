import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// 개발 서버에서만 API·소켓 값을 기록한다. 운영 빌드에서는 번들에서 빠진다
if (import.meta.env.DEV) {
  void import('./dev/apiLog').then(({ installApiLog }) => installApiLog());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
