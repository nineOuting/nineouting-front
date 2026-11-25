import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { listAllFolders, listMyWorkspaces } from '../api/workspace';
import { onSignOut } from '../auth/tokenStore';
import addIcon from '../assets/icons/add.svg';
import archiveIcon from '../assets/icons/nav-archive.svg';
import collapseFolderIcon from '../assets/icons/nav-collapse.svg';
import expandFolderIcon from '../assets/icons/nav-expand.svg';
import folderIcon from '../assets/icons/folder-sm.svg';
import homeIcon from '../assets/icons/home.svg';
import settingsIcon from '../assets/icons/settings.svg';
import collapseIcon from '../assets/icons/sidebar-collapse.svg';
import templateIcon from '../assets/icons/nav-template.svg';
import workspaceIcon from '../assets/icons/nav-workspace.svg';
import { useSettingsModal } from '../pages/settings/useSettingsModal';
import CreateWorkspaceModal from '../pages/workspace/CreateWorkspaceModal';
import type { FolderSummary, WorkspaceSummary } from '../types/workspace';
import Icon from './Icon';
import { folderIconColor } from '../utils/folderColor';
import styles from './Sidebar.module.css';

const MENU_ICON_SIZE = 20;
// 피그마 Sidebar ExpandButton: 28px 버튼 안 20px 화살표
const ARROW_ICON_SIZE = 20;
const SUB_ICON_SIZE = 16;

interface SidebarProps {
  /** 지금 보고 있는 워크스페이스. 메뉴에서 이 워크스페이스의 폴더를 펼쳐 두고, 아카이브도 이 워크스페이스로 연다 */
  workspaceId?: number;
  /** 메뉴 접기 (상단 바의 메뉴 버튼으로 다시 연다) */
  onCollapse: () => void;
}

type FolderItem = Pick<FolderSummary, 'folderId' | 'name' | 'color'>;

/**
 * 화면마다 AppLayout을 새로 그려서 사이드바도 화면을 옮길 때마다 새로 만들어진다. 그때 빈 목록 → 접힌 목록 → 펼친 목록으로
 * 세 번 바뀌며 번쩍이지 않게, 받은 워크스페이스·폴더 목록과 펼친 상태를 앱이 켜져 있는 동안 기억한다.
 * 새로 그릴 때는 기억한 것으로 바로 그리고, 서버에서는 뒤에서 다시 받아 바뀐 것만 반영한다. 로그아웃하면 지운다 (SCRUM-410)
 */
const sidebarCache: { workspaces: WorkspaceSummary[] | null; folders: Record<number, FolderItem[]>; expandedIds: number[] } = {
  workspaces: null,
  folders: {},
  expandedIds: [],
};

onSignOut(() => {
  sidebarCache.workspaces = null;
  sidebarCache.folders = {};
  sidebarCache.expandedIds = [];
});

const menuClass = ({ isActive }: { isActive: boolean }) => [styles.item, isActive ? styles.selected : ''].join(' ');
const subMenuClass = ({ isActive }: { isActive: boolean }) => [styles.subItem, isActive ? styles.selected : ''].join(' ');

function MenuIcon({ src, size = MENU_ICON_SIZE }: { src: string; size?: number }) {
  return <Icon src={src} size={size} className={styles.icon} />;
}

/** 이동할 곳이 아직 없을 때(워크스페이스가 없을 때)는 같은 모양의 글자만 보여 준다 */
function MenuLink({ to, icon, children }: { to: string | undefined; icon: string; children: ReactNode }) {
  const content = (
    <>
      <MenuIcon src={icon} />
      <span className={styles.text}>{children}</span>
    </>
  );
  return to ? (
    <NavLink to={to} className={menuClass}>
      {content}
    </NavLink>
  ) : (
    <span className={styles.item}>{content}</span>
  );
}

/** REQ-001 왼쪽 메뉴 (nep!nep! 디자인 Sidebar). 워크스페이스를 펼치면 그 안의 프로젝트 폴더가 보인다 */
export default function Sidebar({ workspaceId, onCollapse }: SidebarProps) {
  const settings = useSettingsModal();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>(() => sidebarCache.workspaces ?? []);
  const [expandedIds, setExpandedIds] = useState<number[]>(() =>
    workspaceId && !sidebarCache.expandedIds.includes(workspaceId) ? [...sidebarCache.expandedIds, workspaceId] : sidebarCache.expandedIds,
  );
  const [folders, setFolders] = useState<Record<number, FolderItem[]>>(() => sidebarCache.folders);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    listMyWorkspaces()
      .then((items) => {
        sidebarCache.workspaces = items;
        if (isCurrent) {
          setWorkspaces(items);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, []);

  // 펼친 워크스페이스의 폴더는 사이드바가 새로 만들어질 때마다 한 번씩 다시 받는다 (기억한 목록은 먼저 보여 준다)
  const requestedRef = useRef(new Set<number>());
  useEffect(() => {
    sidebarCache.expandedIds = expandedIds;
  }, [expandedIds]);
  useEffect(() => {
    expandedIds
      .filter((id) => !requestedRef.current.has(id))
      .forEach((id) => {
        requestedRef.current.add(id);
        // 들어갈 수 없는 폴더도 보인다. 누르면 폴더 화면이 안내한다 (2026-11-24 QA)
        listAllFolders(id)
          .then((items) => {
            const next = items.map(({ folderId, name, color }) => ({ folderId, name, color }));
            sidebarCache.folders = { ...sidebarCache.folders, [id]: next };
            setFolders((prev) => ({ ...prev, [id]: next }));
          })
          .catch(() => requestedRef.current.delete(id));
      });
  }, [expandedIds]);

  // 워크스페이스 화면으로 오면 그 워크스페이스의 폴더를 펼친다 (QA 2026-11-23).
  // 화면을 불러오는 동안 메뉴가 먼저 그려져 처음 값만으로는 펼치지 못해, 바뀔 때 렌더 중에 맞춘다
  const [shownWorkspaceId, setShownWorkspaceId] = useState(workspaceId);
  if (workspaceId !== shownWorkspaceId) {
    setShownWorkspaceId(workspaceId);
    if (workspaceId !== undefined && !expandedIds.includes(workspaceId)) {
      setExpandedIds([...expandedIds, workspaceId]);
    }
  }

  const toggleWorkspace = (id: number) =>
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

  const currentWorkspaceId = workspaceId ?? workspaces[0]?.workspaceId;

  return (
    <nav className={styles.sidebar} aria-label="메뉴">
      <div className={styles.main}>
        <button type="button" className={styles.collapse} aria-label="메뉴 접기" onClick={onCollapse}>
          <MenuIcon src={collapseIcon} />
        </button>
        <div className={styles.list}>
          <MenuLink to="/home" icon={homeIcon}>
            홈
          </MenuLink>
          {workspaces.map((workspace) => {
            const isExpanded = expandedIds.includes(workspace.workspaceId);
            return (
              <div key={workspace.workspaceId} className={styles.group}>
                <div className={styles.workspaceRow}>
                  <NavLink to={`/workspaces/${workspace.workspaceId}`} end className={menuClass}>
                    <MenuIcon src={workspaceIcon} />
                    <span className={styles.text}>{workspace.name}</span>
                  </NavLink>
                  <button
                    type="button"
                    className={styles.expand}
                    aria-label={`${workspace.name} 폴더 ${isExpanded ? '접기' : '펼치기'}`}
                    aria-expanded={isExpanded}
                    onClick={() => toggleWorkspace(workspace.workspaceId)}
                  >
                    <MenuIcon src={isExpanded ? collapseFolderIcon : expandFolderIcon} size={ARROW_ICON_SIZE} />
                  </button>
                </div>
                {isExpanded && (folders[workspace.workspaceId] ?? []).length > 0 && (
                  <div className={styles.subList}>
                    {(folders[workspace.workspaceId] ?? []).map((folder) => (
                      <NavLink key={folder.folderId} to={`/folders/${folder.folderId}`} className={subMenuClass}>
                        {/* REQ-202 프로젝트 색 */}
                        <span className={styles.folderColor} style={{ color: folderIconColor(folder.color) }}>
                          <MenuIcon src={folderIcon} size={SUB_ICON_SIZE} />
                        </span>
                        <span className={styles.text}>{folder.name}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* 새 워크스페이스 만들기 (REQ-031): 피그마 사이드바에 [새 워크스페이스]가 있어 다시 연다 (2026-11-25 사용자 요청) */}
          <button type="button" className={`${styles.item} ${styles.secondary}`} onClick={() => setIsCreating(true)}>
            <MenuIcon src={addIcon} />
            <span className={styles.text}>새 워크스페이스</span>
          </button>
          <MenuLink
            to={currentWorkspaceId === undefined ? undefined : `/workspaces/${currentWorkspaceId}/archive`}
            icon={archiveIcon}
          >
            회의록 아카이브
          </MenuLink>
          <MenuLink to="/templates" icon={templateIcon}>
            회의록 양식
          </MenuLink>
        </div>
      </div>
      <div className={styles.footer}>
        {/* REQ-145 설정은 보던 화면 위에 창으로 뜬다 */}
        <button type="button" className={subMenuClass({ isActive: settings.tab !== null })} onClick={() => settings.open('profile')}>
          <MenuIcon src={settingsIcon} size={SUB_ICON_SIZE} />
          <span className={styles.text}>설정</span>
        </button>
      </div>
      {/* 새 워크스페이스 만들기 (REQ-031): 피그마 사이드바에 [새 워크스페이스]가 있어 다시 연다 (2026-11-25 사용자 요청) */}
      {isCreating && <CreateWorkspaceModal onClose={() => setIsCreating(false)} />}
    </nav>
  );
}
