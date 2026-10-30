/** API와 같은 주소로 WebSocket을 연다 (개발 중에는 Vite가 /ws를 api-gateway로 넘긴다) */
export function socketUrl(path: string, ticket: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}?ticket=${encodeURIComponent(ticket)}`;
}

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 10000;

/** 1초, 2초, 4초 … 최대 10초 뒤에 다시 붙는다 */
export function retryDelay(attempt: number) {
  return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
}
