import { setAccessToken } from '../auth/tokenStore';
import { request, setTokenRefresher } from './client';

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

interface PasswordResetVerifyResponse {
  resetToken: string;
}

/** REQ-011 회원가입 인증 메일 발송 */
export function sendEmailVerification(email: string) {
  return request('POST', '/api/auth/email-verifications', { email });
}

/** REQ-011 인증 코드 확인 */
export function confirmEmailVerification(email: string, code: string) {
  return request('POST', '/api/auth/email-verifications/confirm', { email, code });
}

/** REQ-010~014 회원가입 */
export function signup(email: string, password: string, name: string) {
  return request<{ userId: number }>('POST', '/api/auth/signup', { email, password, name });
}

/**
 * REQ-005~007 로그인. refresh 토큰은 HttpOnly 쿠키로 따로 온다.
 * REQ-184 로그인 상태 유지: 켜면 14일, 끄면 1시간 (브라우저를 닫아도 그 시간 안이면 유지, 쓰는 동안 연장)
 */
export async function login(email: string, password: string, keepLoggedIn: boolean) {
  const { accessToken } = await request<TokenResponse>('POST', '/api/auth/login', { email, password, keepLoggedIn });
  setAccessToken(accessToken);
}

let refreshing: Promise<void> | null = null;

/**
 * refresh 쿠키로 access 토큰을 다시 받는다 (새로고침 후 로그인 유지).
 * 서버는 refresh 토큰을 쓸 때마다 교체하고 재사용을 막으므로, 동시에 불려도 요청은 한 번만 보낸다.
 */
export function refresh() {
  refreshing ??= request<TokenResponse>('POST', '/api/auth/refresh')
    .then(({ accessToken }) => setAccessToken(accessToken))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

setTokenRefresher(refresh);

// 같은 브라우저의 다른 탭에 로그아웃을 알린다. 탭마다 access 토큰을 메모리에 따로 들고 있어서,
// 알리지 않으면 다른 탭은 그 토큰이 만료될 때(최대 30분)까지 계속 쓸 수 있다
const AUTH_CHANNEL = 'nepnep-auth';
const LOGGED_OUT = 'logged-out';
// 로그인하지 않아도 보는 화면에서는 다시 보낼 곳이 없다
const PUBLIC_PATHS = ['/login', '/signup', '/password'];
const authChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL);

authChannel?.addEventListener('message', (event: MessageEvent) => {
  if (event.data !== LOGGED_OUT) {
    return;
  }
  setAccessToken(null);
  if (!PUBLIC_PATHS.some((path) => window.location.pathname.startsWith(path))) {
    window.location.replace('/login');
  }
});

/** 로그아웃. refresh 쿠키를 지우고 메모리의 access 토큰도 버리고, 다른 탭도 로그아웃시킨다 */
export async function logout() {
  try {
    await request('POST', '/api/auth/logout');
  } finally {
    setAccessToken(null);
    authChannel?.postMessage(LOGGED_OUT);
  }
}

/** REQ-009 비밀번호 찾기 인증 번호 발송 */
export function requestPasswordReset(email: string) {
  return request('POST', '/api/auth/password-reset', { email });
}

/** REQ-009 인증 번호 확인. 새 비밀번호 설정에 쓸 재설정 토큰을 돌려준다 */
export async function verifyPasswordReset(email: string, code: string) {
  const { resetToken } = await request<PasswordResetVerifyResponse>('POST', '/api/auth/password-reset/verify', {
    email,
    code,
  });
  return resetToken;
}

/** REQ-009 새 비밀번호 설정 */
export function confirmPasswordReset(token: string, newPassword: string) {
  return request('POST', '/api/auth/password-reset/confirm', { token, newPassword });
}
