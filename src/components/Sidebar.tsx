import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { listFolders, listMyWorkspaces } from '../api/workspace';
import addIcon from '../assets/icons/add.svg';
import archiveIcon from '../assets/icons/archive.svg';
import arrowDownIcon from '../assets/icons/arrow-down.svg';
import arrowUpIcon from '../assets/icons/arrow-up.svg';
import folderIcon from '../assets/icons/folder-sm.svg';
import helpIcon from '../assets/icons/help.svg';
import homeIcon from '../assets/icons/home.svg';
import settingsIcon from '../assets/icons/settings.svg';
import collapseIcon from '../assets/icons/sidebar-collapse.svg';
import templateIcon from '../assets/icons/template.svg';
import workspaceIcon from '../assets/icons/workspace.svg';
import CreateWorkspaceModal from '../pages/workspace/CreateWorkspaceModal';
import type { FolderSummary, WorkspaceSummary } from '../types/workspace';
import Icon from './Icon';
import styles from './Sidebar.module.css';

const MENU_ICON_SIZE = 20;
const ARROW_ICON_SIZE = 24;
const SUB_ICON_SIZE = 16;

interface SidebarProps {
  /** 지금 보고 있는 워크스페이스. 메뉴에서 이 워크스페이스의 폴더를 펼쳐 두고, 아카이브도 이 워크스페이스로 연다 */
  workspaceId?: number;
  /** 메뉴 접기 (상단 바의 메뉴 버튼으로 다시 연다) */
  onCollapse: () => void;
}

type FolderItem = Pick<FolderSummary, 'folderId' | 'name'>;

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
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [expandedIds, setExpandedIds] = useState<number[]>(workspaceId ? [workspaceId] : []);
  const [folders, setFolders] = useState<Record<number, FolderItem[]>>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    listMyWorkspaces()
      .then((items) => isCurrent && setWorkspaces(items))
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
                    <MenuIcon src={isExpanded ? arrowUpIcon : arrowDownIcon} size={ARROW_ICON_SIZE} />
                  </button>
                </div>
                {isExpanded && (folders[workspace.workspaceId] ?? []).length > 0 && (
                  <div className={styles.subList}>
                    {(folders[workspace.workspaceId] ?? []).map((folder) => (
                      <NavLink key={folder.folderId} to={`/folders/${folder.folderId}`} className={subMenuClass}>
                        <MenuIcon src={folderIcon} size={SUB_ICON_SIZE} />
                        <span className={styles.text}>{folder.name}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
        <NavLink to="/help" className={subMenuClass}>
          <MenuIcon src={helpIcon} size={SUB_ICON_SIZE} />
          <span className={styles.text}>도움말</span>
        </NavLink>
        <NavLink to="/settings" className={subMenuClass}>
          <MenuIcon src={settingsIcon} size={SUB_ICON_SIZE} />
          <span className={styles.text}>설정</span>
        </NavLink>
      </div>
      {isCreating && <CreateWorkspaceModal onClose={() => setIsCreating(false)} />}
    </nav>
  );
}
