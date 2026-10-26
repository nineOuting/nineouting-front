import { getAccessToken } from '../auth/tokenStore';
import type { Member } from '../types/meeting';
import { request } from './client';

interface MyProfileResponse {
  userId: number;
  email: string;
  name: string;
  profileImageUrl: string | null;
}

export type Me = Member & { email: string };

let cached: { token: string | null; me: Promise<Me> } | null = null;

/** 로그인한 사용자. 회의록 작성자인지 등을 가릴 때 쓰고, 같은 로그인 동안은 한 번만 부른다 */
export function getMe() {
  const token = getAccessToken();
  if (!cached || cached.token !== token) {
    const me = request<MyProfileResponse>('GET', '/api/users/me').then(({ userId, email, name, profileImageUrl }) => ({
      userId,
      email,
      name,
      profileImageUrl: profileImageUrl ?? undefined,
    }));
    me.catch(() => {
      cached = null;
    });
    cached = { token, me };
  }
  return cached.me;
}
