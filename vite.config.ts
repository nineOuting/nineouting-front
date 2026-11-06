import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// refresh 토큰 쿠키가 SameSite=Strict라 개발 중에도 API를 같은 주소(/api)로 부르고 api-gateway로 넘긴다
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';
// 개발 화면(/dev/minutes)에서 ai-service의 회의 상태만 본다. 전사 내용이 없는 status 경로 하나만 연다
const AI_PROXY_TARGET = process.env.AI_PROXY_TARGET ?? 'http://localhost:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: API_PROXY_TARGET, changeOrigin: true },
      // 회의방·음성 WebSocket (/ws/meetings/**, /ws/stt/**)
      '/ws': { target: API_PROXY_TARGET, changeOrigin: true, ws: true },
      '^/__ai/meetings/\\d+/status$': {
        target: AI_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__ai/, '/internal'),
      },
    },
  },
});
