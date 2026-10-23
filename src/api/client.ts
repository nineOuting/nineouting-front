import { getAccessToken } from '../auth/tokenStore';

// 서버에 닿지 못했거나 응답 형식이 다를 때 쓰는 코드 (서버 에러 코드와 겹치지 않게 프론트 전용 이름을 쓴다)
export const NETWORK_ERROR = 'NETWORK_ERROR';
const NETWORK_ERROR_MESSAGE = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  code?: string;
}

export interface FieldError {
  field: string;
  reason: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(code: string, message: string, status: number, fieldErrors: FieldError[] = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** 서버 메시지는 화면에 그대로 보여 줄 수 있는 한국어다 (docs/coding-conventions.md 4장) */
export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

let refreshAccessToken: (() => Promise<void>) | null = null;

/** access 토큰이 만료(401)되면 refresh 쿠키로 다시 받고 한 번 더 부른다. auth.ts가 등록한다 (서로 import하지 않도록) */
export function setTokenRefresher(refresher: () => Promise<void>) {
  refreshAccessToken = refresher;
}

/** user-service 등 백엔드 API 호출. 응답 형식은 { success, data, message, code } (docs/coding-conventions.md 4장) */
export async function request<T = void>(method: Method, path: string, body?: unknown): Promise<T> {
  try {
    return await send<T>(method, path, body);
  } catch (error) {
    // 회의는 access 토큰 유효 시간(30분)보다 길 수 있다. 인증 API 자체의 401은 다시 부르지 않는다
    const canRetry = isApiError(error) && error.status === 401 && getAccessToken() && !path.startsWith('/api/auth/');
    if (!canRetry || !refreshAccessToken) {
      throw error;
    }
    await refreshAccessToken();
    return send<T>(method, path, body);
  }
}

async function send<T>(method: Method, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  let payload: ApiResponse<T>;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(NETWORK_ERROR, NETWORK_ERROR_MESSAGE, 0);
  }

  if (!response.ok || !payload.success) {
    const fieldErrors = Array.isArray(payload.data) ? (payload.data as FieldError[]) : [];
    throw new ApiError(payload.code ?? NETWORK_ERROR, payload.message || NETWORK_ERROR_MESSAGE, response.status, fieldErrors);
  }
  return payload.data;
}
