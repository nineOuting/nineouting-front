import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// refresh 토큰 쿠키가 SameSite=Strict라 개발 중에도 API를 같은 주소(/api)로 부르고 api-gateway로 넘긴다
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: API_PROXY_TARGET, changeOrigin: true },
    },
  },
});
