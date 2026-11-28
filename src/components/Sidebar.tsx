import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { listAllFolders, listMyWorkspaces, NAV_CHANGED_EVENT } from '../api/workspace';
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
import type { WorkspaceSummary } from '../types/workspace';
import Icon from './Icon';
import { folderIconColor } from '../utils/folderColor';
import styles from './Sidebar.module.css';
import Skeleton from './Skeleton';
import { sidebarCache, type SidebarFolderItem } from './sidebarCache';

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

type FolderItem = SidebarFolderItem;

/**
 * 처음 펼칠 때 폴더를 받는 동안 그 자리에 회색 줄을 그린다. 다 받으면 아래 메뉴가 밀리지 않게 줄 수를 지난번 폴더 수로 맞춘다.
 * 새로고침해도 맞도록 워크스페이스별 폴더 수(이름 없이 숫자만)를 기억한다. 처음 보는 워크스페이스는 3줄
 */
const FOLDER_COUNT_KEY = 'nineouting:sidebar-folder-counts';
const DEFAULT_FOLDER_ROWS = 3;
const FOLDER_ROW_HEIGHT = 36;

function readFolderCounts(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FOLDER_COUNT_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function rememberFolderCount(workspaceId: number, count: number) {
  try {
    localStorage.setItem(FOLDER_COUNT_KEY, JSON.stringify({ ...readFolderCounts(), [workspaceId]: count }));
  } catch {
    // 저장할 수 없으면 다음에도 기본 줄 수로 그린다
  }
}

function loadingFolderRows(workspaceId: number) {
  const count = readFolderCounts()[workspaceId];
  return typeof count === 'number' && count >= 0 ? count : DEFAULT_FOLDER_ROWS;
}

/** 새로고침 직후 워크스페이스 목록을 받는 동안의 회색 줄 수 (지난번 개수, 처음이면 1줄) */
const WORKSPACE_COUNT_KEY = 'nineouting:sidebar-workspace-count';
const WORKSPACE_ROW_HEIGHT = 40;

function loadingWorkspaceRows() {
  const count = Number(localStorage.getItem(WORKSPACE_COUNT_KEY));
  return Number.isInteger(count) && count > 0 ? count : 1;
}

function rememberWorkspaceCount(count: number) {
  try {
    localStorage.setItem(WORKSPACE_COUNT_KEY, String(count));
  } catch {
    // 저장할 수 없으면 다음에도 1줄로 그린다
  }
}

// 기억한 목록(sidebarCache)은 그 파일에서 지운다. 여기서는 숫자만 저장한 localStorage를 지운다
onSignOut(() => {
  localStorage.removeItem(FOLDER_COUNT_KEY);
  localStorage.removeItem(WORKSPACE_COUNT_KEY);
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
  // 새로고침 직후 처음 받기 전에는 워크스페이스 자리에 회색 줄 (다 받으면 아래 메뉴가 밀리지 않게)
  const [isWorkspacesLoaded, setIsWorkspacesLoaded] = useState(() => sidebarCache.workspaces !== null);
  const [expandedIds, setExpandedIds] = useState<number[]>(() =>
    workspaceId && !sidebarCache.expandedIds.includes(workspaceId) ? [...sidebarCache.expandedIds, workspaceId] : sidebarCache.expandedIds,
  );
  const [folders, setFolders] = useState<Record<number, FolderItem[]>>(() => sidebarCache.folders);
  const [isCreating, setIsCreating] = useState(false);
  // 워크스페이스, 폴더를 만들거나 바꾸면 올려서 목록을 다시 받는다 (같은 화면 안에서는 사이드 바가 새로 만들어지지 않는다)
  const [reloadKey, setReloadKey] = useState(0);
  const requestedRef = useRef(new Set<number>());
  // 공통 틀 안에서는 사이드 바가 새로 만들어지지 않으므로, 화면을 옮길 때마다 목록을 조용히 다시 받는다
  // (다른 사람이 만든 워크스페이스, 폴더도 보이게. 기억한 목록으로 먼저 그려서 화면은 바뀌지 않는다)
  const { pathname } = useLocation();
  const requestedPathRef = useRef(pathname);

  useEffect(() => {
    const reload = () => {
      requestedRef.current.clear();
      setReloadKey((key) => key + 1);
    };
    window.addEventListener(NAV_CHANGED_EVENT, reload);
    return () => window.removeEventListener(NAV_CHANGED_EVENT, reload);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    listMyWorkspaces()
      .then((items) => {
        sidebarCache.workspaces = items;
        rememberWorkspaceCount(items.length);
        if (isCurrent) {
          setWorkspaces(items);
          setIsWorkspacesLoaded(true);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [reloadKey, pathname]);

  // 펼친 워크스페이스의 폴더는 화면을 옮길 때마다, 목록이 바뀌었다는 알림을 받을 때마다 다시 받는다
  // (기억한 목록은 먼저 보여 준다)
  useEffect(() => {
    sidebarCache.expandedIds = expandedIds;
  }, [expandedIds]);
  useEffect(() => {
    if (requestedPathRef.current !== pathname) {
      requestedPathRef.current = pathname;
      requestedRef.current.clear();
    }
    expandedIds
      .filter((id) => !requestedRef.current.has(id))
      .forEach((id) => {
        requestedRef.current.add(id);
        // 들어갈 수 없는 폴더도 보인다. 누르면 폴더 화면이 안내한다 (2026-11-24 QA)
        listAllFolders(id)
          .then((items) => {
            const next = items.map(({ folderId, name, color }) => ({ folderId, name, color }));
            sidebarCache.folders = { ...sidebarCache.folders, [id]: next };
            rememberFolderCount(id, next.length);
            setFolders((prev) => ({ ...prev, [id]: next }));
          })
          .catch(() => requestedRef.current.delete(id));
      });
  }, [expandedIds, reloadKey, pathname]);

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
          {!isWorkspacesLoaded &&
            Array.from({ length: loadingWorkspaceRows() }, (_, index) => (
              <Skeleton key={index} height={WORKSPACE_ROW_HEIGHT} />
            ))}
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
                {isExpanded && folders[workspace.workspaceId] === undefined && loadingFolderRows(workspace.workspaceId) > 0 && (
                  <div className={styles.subList} aria-hidden="true">
                    {Array.from({ length: loadingFolderRows(workspace.workspaceId) }, (_, index) => (
                      <Skeleton key={index} height={FOLDER_ROW_HEIGHT} />
                    ))}
                  </div>
                )}
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
