// access 토큰은 XSS로 꺼내 가기 어렵도록 메모리에만 둔다. 새로고침하면 사라지므로 refresh 쿠키로 다시 받는다
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}
