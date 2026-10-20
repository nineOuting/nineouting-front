import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { refresh } from '../api/auth';
import { getAccessToken } from './tokenStore';

type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

/** 로그인한 사용자만 볼 수 있는 화면. access 토큰이 없으면(새로고침 등) refresh 쿠키로 다시 받아 본다 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(getAccessToken() ? 'authenticated' : 'checking');

  useEffect(() => {
    if (status !== 'checking') {
      return;
    }
    refresh()
      .then(() => setStatus('authenticated'))
      .catch(() => setStatus('anonymous'));
  }, [status]);

  if (status === 'checking') {
    return null;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return children;
}
