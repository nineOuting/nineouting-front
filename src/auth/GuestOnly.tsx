import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { refresh } from '../api/auth';
import { getAccessToken } from './tokenStore';

type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

/**
 * 로그인하지 않은 사람만 보는 화면 (로그인, 회원가입). 이미 로그인했으면 홈으로 보낸다
 * (로그인하면 보려던 화면이 있으면 그곳으로). 새로고침 등으로 토큰이 메모리에 없으면 refresh 쿠키로 확인한다
 */
export default function GuestOnly({ children }: { children: ReactNode }) {
  const location = useLocation();
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
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/home'} replace />;
  }
  return children;
}
