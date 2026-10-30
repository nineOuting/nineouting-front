import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getMe } from '../api/user';
import { listFolders, listMyWorkspaces } from '../api/workspace';
import dividerSidebar from '../assets/divider-sidebar.svg';
import dividerSidebarTop from '../assets/divider-sidebar-top.svg';
import type { FolderSummary, WorkspaceSummary } from '../types/workspace';
import Placeholder from './Placeholder';
import styles from './Sidebar.module.css';

const DIVIDER_WIDTH = 210;
const HOME_ICON_SIZE = 22;
const MENU_ICON_SIZE = 24;
const SMALL_ICON_SIZE = 18;
// 디자인에만 있고 아직 기능이 없는 메뉴 (docs/backlog.md)
const PENDING_MENUS = ['도움말', '설정'];

interface SidebarProps {
  /** 지금 보고 있는 워크스페이스. 메뉴에서 이 워크스페이스의 폴더를 펼쳐 두고, 아카이브도 이 워크스페이스로 연다 */
  workspaceId?: number;
}

type FolderItem = Pick<FolderSummary, 'folderId' | 'name'>;

function Divider({ top = false }: { top?: boolean }) {
  return <img src={top ? dividerSidebarTop : dividerSidebar} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />;
}

/** REQ-001 왼쪽 메뉴 (Figma 23-2 홈 디자인). 워크스페이스를 펼치면 그 안의 프로젝트 폴더가 보인다 */
export default function Sidebar({ workspaceId }: SidebarProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isWorkspacesOpen, setIsWorkspacesOpen] = useState(true);
  const [expandedIds, setExpandedIds] = useState<number[]>(workspaceId ? [workspaceId] : []);
  const [folders, setFolders] = useState<Record<number, FolderItem[]>>({});
  const [myName, setMyName] = useState('');

  useEffect(() => {
    let isCurrent = true;
    listMyWorkspaces()
      .then((items) => isCurrent && setWorkspaces(items))
      .catch(() => undefined);
    getMe()
      .then((me) => isCurrent && setMyName(me.name))
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, []);

  // 펼친 워크스페이스의 폴더는 한 번만 받는다
  const requestedRef = useRef(new Set<number>());
  useEffect(() => {
    expandedIds
      .filter((id) => !requestedRef.current.has(id))
      .forEach((id) => {
        requestedRef.current.add(id);
        listFolders(id)
          .then((items) =>
            setFolders((prev) => ({ ...prev, [id]: items.map(({ folderId, name }) => ({ folderId, name })) })),
          )
          .catch(() => requestedRef.current.delete(id));
      });
  }, [expandedIds]);

  const toggleWorkspace = (id: number) =>
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

  const archiveWorkspaceId = workspaceId ?? workspaces[0]?.workspaceId;

  return (
    <nav className={styles.sidebar} aria-label="메뉴">
      <div className={styles.menu}>
        <Divider top />
        <NavLink to="/home" className={styles.row}>
          <span className={`${styles.label} ${styles.wideGap}`}>
            <Placeholder size={HOME_ICON_SIZE} />
            <span className={styles.text}>홈</span>
          </span>
        </NavLink>
        <Divider />
        <div className={styles.group}>
          <div className={styles.row}>
            <span className={styles.label}>
              <Placeholder size={MENU_ICON_SIZE} />
              <span className={styles.text}>워크스페이스</span>
            </span>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={isWorkspacesOpen ? '워크스페이스 목록 접기' : '워크스페이스 목록 펼치기'}
              aria-expanded={isWorkspacesOpen}
              onClick={() => setIsWorkspacesOpen((open) => !open)}
            >
              <Placeholder size={SMALL_ICON_SIZE} />
            </button>
          </div>
          {isWorkspacesOpen &&
            workspaces.map((workspace) => {
              const isExpanded = expandedIds.includes(workspace.workspaceId);
              return (
                <div key={workspace.workspaceId} className={styles.group}>
                  <div className={styles.row}>
                    <Link to={`/workspaces/${workspace.workspaceId}`} className={`${styles.label} ${styles.wideGap}`}>
                      <Placeholder size={MENU_ICON_SIZE} />
                      <span className={styles.workspaceName}>{workspace.name}</span>
                    </Link>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`${workspace.name} 폴더 ${isExpanded ? '접기' : '펼치기'}`}
                      aria-expanded={isExpanded}
                      onClick={() => toggleWorkspace(workspace.workspaceId)}
                    >
                      <Placeholder size={SMALL_ICON_SIZE} />
                    </button>
                  </div>
                  {isExpanded &&
                    (folders[workspace.workspaceId] ?? []).map((folder) => (
                      <NavLink key={folder.folderId} to={`/folders/${folder.folderId}`} className={styles.folder}>
                        <Placeholder size={SMALL_ICON_SIZE} />
                        <span className={styles.text}>{folder.name}</span>
                      </NavLink>
                    ))}
                </div>
              );
            })}
        </div>
        <Divider />
        {archiveWorkspaceId !== undefined ? (
          <NavLink to={`/workspaces/${archiveWorkspaceId}/archive`} className={styles.row}>
            <span className={styles.label}>
              <Placeholder size={MENU_ICON_SIZE} />
              <span className={styles.text}>회의록 아카이브</span>
            </span>
            <Placeholder size={SMALL_ICON_SIZE} />
          </NavLink>
        ) : (
          <span className={styles.row}>
            <span className={styles.label}>
              <Placeholder size={MENU_ICON_SIZE} />
              <span className={styles.text}>회의록 아카이브</span>
            </span>
            <Placeholder size={SMALL_ICON_SIZE} />
          </span>
        )}
        <Divider />
        <NavLink to="/templates" className={styles.row}>
          <span className={styles.label}>
            <Placeholder size={MENU_ICON_SIZE} />
            <span className={styles.text}>회의록 템플릿</span>
          </span>
          <Placeholder size={SMALL_ICON_SIZE} />
        </NavLink>
        <Divider />
      </div>
      <div className={styles.bottom}>
        {/* REQ-143 쓰레기통도 아카이브처럼 지금 보고 있는 워크스페이스로 연다 */}
        {archiveWorkspaceId !== undefined ? (
          <NavLink to={`/workspaces/${archiveWorkspaceId}/trash`} className={styles.row}>
            <span className={styles.text}>쓰레기통</span>
            <Placeholder size={SMALL_ICON_SIZE} />
          </NavLink>
        ) : (
          <span className={styles.row}>
            <span className={styles.text}>쓰레기통</span>
            <Placeholder size={SMALL_ICON_SIZE} />
          </span>
        )}
        {PENDING_MENUS.map((menu) => (
          <button key={menu} type="button" className={styles.row} disabled title="준비 중인 메뉴예요">
            <span className={styles.text}>{menu}</span>
            <Placeholder size={SMALL_ICON_SIZE} />
          </button>
        ))}
        <div className={styles.row}>
          <span className={styles.me}>
            <Placeholder size={SMALL_ICON_SIZE} />
            <span className={styles.text}>{myName && `${myName}님`}</span>
          </span>
          <Placeholder size={SMALL_ICON_SIZE} />
        </div>
      </div>
    </nav>
  );
}
