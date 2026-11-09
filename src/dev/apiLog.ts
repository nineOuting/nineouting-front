/** 개발 모드에서만 쓴다. 프론트가 주고받은 API·소켓 값을 다른 탭의 개발 화면(/dev/minutes)으로 보낸다 */

export const API_LOG_CHANNEL = 'dev-api-log';

export interface ApiLogEntry {
  at: string;
  label: string;
  status?: number;
  request?: unknown;
  response?: unknown;
}

const SECRET_KEY = /token|ticket|password|secret/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[가림]' : redact(item)]),
    );
  }
  return value;
}

function parsed(text: string) {
  try {
    return redact(JSON.parse(text));
  } catch {
    return `(JSON 아님, ${text.length}자)`;
  }
}

export function installApiLog() {
  // 개발 화면 자신의 주기 조회는 기록하지 않는다
  if (window.location.pathname.startsWith('/dev/')) {
    return;
  }
  const channel = new BroadcastChannel(API_LOG_CHANNEL);
  const post = (entry: Omit<ApiLogEntry, 'at'>) => channel.postMessage({ at: new Date().toISOString(), ...entry });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    const path = url.pathname + url.search;
    if (!url.pathname.startsWith('/api/')) {
      return originalFetch(input, init);
    }
    const label = `${init?.method ?? 'GET'} ${path}`;
    const request = typeof init?.body === 'string' ? parsed(init.body) : undefined;
    try {
      const response = await originalFetch(input, init);
      const isJson = response.headers.get('Content-Type')?.includes('json');
      if (isJson) {
        void response
          .clone()
          .text()
          .then((text) => post({ label, status: response.status, request, response: parsed(text) }));
      } else {
        post({ label, status: response.status, request, response: '(파일 또는 빈 응답)' });
      }
      return response;
    } catch (error) {
      post({ label, request, response: `요청 실패: ${String(error)}` });
      throw error;
    }
  };

  window.WebSocket = class extends window.WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      // 주소의 입장권이 기록에 남지 않게 경로만 쓴다
      const path = new URL(String(url), window.location.href).pathname;
      if (!path.startsWith('/ws/')) {
        return;
      }
      this.addEventListener('open', () => post({ label: `소켓 연결 ${path}` }));
      this.addEventListener('close', (event) => post({ label: `소켓 닫힘 ${path}`, status: event.code }));
      this.addEventListener('message', (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          const response = parsed(event.data);
          const type = (response as { type?: unknown }).type;
          post({ label: `소켓 수신 ${path} ${typeof type === 'string' ? type : ''}`, response });
        }
      });
    }
  };
}
