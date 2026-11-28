import { onSignOut } from '../auth/tokenStore';
import type { FolderSummary, WorkspaceSummary } from '../types/workspace';

export type SidebarFolderItem = Pick<FolderSummary, 'folderId' | 'name' | 'color'>;

/**
 * 화면마다 AppLayout을 새로 그려서 사이드바도 화면을 옮길 때마다 새로 만들어진다. 그때 빈 목록 → 접힌 목록 → 펼친 목록으로
 * 세 번 바뀌며 번쩍이지 않게, 받은 워크스페이스·폴더 목록과 펼친 상태를 앱이 켜져 있는 동안 기억한다.
 * 새로 그릴 때는 기억한 것으로 바로 그리고, 서버에서는 뒤에서 다시 받아 바뀐 것만 반영한다. 로그아웃하면 지운다 (SCRUM-410)
 * 이름은 메모리에만 둔다. 새로고침하면 비고, 그때 화면은 이름 자리를 회색으로 그린다 (SCRUM-440)
 */
export const sidebarCache: {
  workspaces: WorkspaceSummary[] | null;
  folders: Record<number, SidebarFolderItem[]>;
  expandedIds: number[];
} = {
  workspaces: null,
  folders: {},
  expandedIds: [],
};

onSignOut(() => {
  sidebarCache.workspaces = null;
  sidebarCache.folders = {};
  sidebarCache.expandedIds = [];
});

/** 앱 안에서 옮겨 다닐 때 워크스페이스 화면이 불러오는 동안 이름을 바로 그리려고 쓴다. 모르면 undefined */
export function peekWorkspaceName(workspaceId: number): string | undefined {
  return sidebarCache.workspaces?.find((workspace) => workspace.workspaceId === workspaceId)?.name;
}

/** 폴더 화면이 불러오는 동안 이름과 색을 바로 그리려고 쓴다. 사이드 바에 펼친 적 없는 워크스페이스의 폴더면 undefined */
export function peekFolder(folderId: number): SidebarFolderItem | undefined {
  for (const items of Object.values(sidebarCache.folders)) {
    const found = items.find((folder) => folder.folderId === folderId);
    if (found) {
      return found;
    }
  }
  return undefined;
}
