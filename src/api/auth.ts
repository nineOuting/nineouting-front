import { setAccessToken } from '../auth/tokenStore';
import { request } from './client';

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

/** REQ-005~007 로그인. refresh 토큰은 HttpOnly 쿠키로 따로 온다 */
export async function login(email: string, password: string) {
  const { accessToken } = await request<TokenResponse>('POST', '/api/auth/login', { email, password });
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
