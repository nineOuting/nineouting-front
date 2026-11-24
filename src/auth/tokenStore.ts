// access 토큰은 XSS로 꺼내 가기 어렵도록 메모리에만 둔다. 새로고침하면 사라지므로 refresh 쿠키로 다시 받는다
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

// 토큰을 버릴 때(로그아웃, 세션 만료, 다른 탭 로그아웃) 화면이 기억해 둔 사용자 데이터를 지우게 알린다
const signOutListeners = new Set<() => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token === null) {
    signOutListeners.forEach((listener) => listener());
  }
}

/** 토큰을 버릴 때 부를 함수를 등록한다 (사이드바의 워크스페이스·폴더 기억 등) */
export function onSignOut(listener: () => void) {
  signOutListeners.add(listener);
  return () => signOutListeners.delete(listener);
}
