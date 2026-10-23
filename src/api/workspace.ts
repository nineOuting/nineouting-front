import type { Member } from '../types/meeting';
import { request } from './client';

interface FolderMemberResponse {
  userId: number;
  name: string;
  profileImageUrl: string | null;
}

/** REQ-061 회의 참석자는 폴더에 들어갈 수 있는 사람 중에서 고른다 */
export async function listFolderMembers(folderId: number): Promise<Member[]> {
  const members = await request<FolderMemberResponse[]>('GET', `/api/folders/${folderId}/members`);
  return members.map(({ userId, name, profileImageUrl }) => ({ userId, name, profileImageUrl: profileImageUrl ?? undefined }));
}
