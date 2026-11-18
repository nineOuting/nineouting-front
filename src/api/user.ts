import { getAccessToken } from '../auth/tokenStore';
import type { Member } from '../types/meeting';
import { request } from './client';

interface MyProfileResponse {
  userId: number;
  email: string;
  name: string;
  affiliation: string | null;
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

// user-service가 받는 사진 형식
export const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface MyProfile {
  email: string;
  name: string;
  profileImageUrl?: string;
}

const toMyProfile = ({ email, name, profileImageUrl }: MyProfileResponse): MyProfile => ({
  email,
  name,
  profileImageUrl: profileImageUrl ?? undefined,
});

/** 계정 프로필이 바뀌면 상단 바 등이 새 값을 받도록 getMe 캐시를 비운다 */
function forgetMe() {
  cached = null;
}

/** REQ-114, 115 프로필 (설정 > 프로필). 모든 워크스페이스에 공통이다 */
export async function getMyProfile() {
  return toMyProfile(await request<MyProfileResponse>('GET', '/api/users/me'));
}

/** REQ-114 이름 */
export async function updateMyProfile(changes: { name?: string }) {
  const updated = toMyProfile(await request<MyProfileResponse>('PATCH', '/api/users/me', changes));
  forgetMe();
  return updated;
}

/** REQ-116 비밀번호 변경 */
export function changePassword(currentPassword: string, newPassword: string) {
  return request('PUT', '/api/users/me/password', { currentPassword, newPassword });
}

/** REQ-115 계정 사진을 S3에 직접 올린 뒤 등록한다 */
export async function uploadMyProfileImage(file: File) {
  const { uploadUrl, imageKey } = await request<{ uploadUrl: string; imageKey: string }>(
    'POST',
    '/api/users/me/profile-image/upload-url',
    { contentType: file.type },
  );
  const uploaded = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!uploaded.ok) {
    throw new Error(`profile image upload failed: ${uploaded.status}`);
  }
  const { profileImageUrl } = await request<{ profileImageUrl: string }>('PUT', '/api/users/me/profile-image', {
    imageKey,
  });
  forgetMe();
  return profileImageUrl;
}

/** REQ-115 계정 사진 지우기 */
export async function deleteMyProfileImage() {
  await request('DELETE', '/api/users/me/profile-image');
  forgetMe();
}
