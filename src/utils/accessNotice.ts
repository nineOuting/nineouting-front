import { isApiError } from '../api/client';

/** forbidden: 권한 없는 링크 (REQ-205), deleted: 삭제된 회의·회의록 링크 (REQ-206). restorable이면 [삭제 목록 보기]도 보인다 */
export type AccessNoticeKind = 'forbidden' | 'deleted' | 'deletedRestorable';

/** 서버 오류가 링크 안내 화면으로 보여 줄 것이면 그 종류, 아니면 null */
export function accessNoticeOf(error: unknown): AccessNoticeKind | null {
  if (!isApiError(error)) {
    return null;
  }
  if (error.code === 'MEETING_DELETED_RESTORABLE') {
    return 'deletedRestorable';
  }
  if (error.code === 'MEETING_DELETED') {
    return 'deleted';
  }
  return error.status === 403 ? 'forbidden' : null;
}
