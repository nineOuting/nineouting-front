import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { listMyWorkspaces, NAV_CHANGED_EVENT } from '../api/workspace';
import addIcon from '../assets/icons/add.svg';
import archiveIcon from '../assets/icons/nav-archive.svg';
import homeIcon from '../assets/icons/home.svg';
import settingsIcon from '../assets/icons/settings.svg';
import expandIcon from '../assets/icons/sidebar-collapse.svg';
import templateIcon from '../assets/icons/nav-template.svg';
import workspaceIcon from '../assets/icons/nav-workspace.svg';
import { useSettingsModal } from '../pages/settings/useSettingsModal';
import CreateWorkspaceModal from '../pages/workspace/CreateWorkspaceModal';
import type { WorkspaceSummary } from '../types/workspace';
import Icon from './Icon';
import styles from './SidebarRail.module.css';

const ICON_SIZE = 20;

const railClass = ({ isActive }: { isActive: boolean }) => [styles.item, isActive ? styles.selected : ''].join(' ');

interface SidebarRailProps {
  workspaceId?: number;
  onExpand: () => void;
}

/**
 * REQ-001 접힌 사이드바 (디자인 SidebarCollapsedPage): 아이콘만 보이는 좁은 사이드바.
 * 아이콘에 마우스를 올리면 메뉴 이름이 보인다 (REQ-181 툴팁)
 */
export default function SidebarRail({ workspaceId, onExpand }: SidebarRailProps) {
  const settings = useSettingsModal();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  // 워크스페이스를 만들거나 바꾸면 다시 받는다 (새 워크스페이스가 목록에 없으면 아이콘이 첫 워크스페이스로 연결된다)
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const reload = () => setReloadKey((key) => key + 1);
    window.addEventListener(NAV_CHANGED_EVENT, reload);
    return () => window.removeEventListener(NAV_CHANGED_EVENT, reload);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    listMyWorkspaces()
      .then((items) => isCurrent && setWorkspaces(items))
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [reloadKey]);

  const currentWorkspace = workspaces.find((workspace) => workspace.workspaceId === workspaceId) ?? workspaces[0];

  return (
    <nav className={styles.rail} aria-label="메뉴">
      <div className={styles.list}>
        <button type="button" className={styles.item} aria-label="메뉴 펼치기" onClick={onExpand}>
          <Icon src={expandIcon} size={ICON_SIZE} className={styles.flipped} />
        </button>
        <NavLink to="/home" className={railClass} aria-label="홈">
          <Icon src={homeIcon} size={ICON_SIZE} />
        </NavLink>
        {currentWorkspace && (
          <NavLink to={`/workspaces/${currentWorkspace.workspaceId}`} end className={railClass} aria-label={currentWorkspace.name}>
            <Icon src={workspaceIcon} size={ICON_SIZE} />
          </NavLink>
        )}
        {/* 새 워크스페이스 만들기 (REQ-031): 피그마 사이드바에 [새 워크스페이스]가 있어 다시 연다 (2026-11-25 사용자 요청) */}
        <button type="button" className={styles.item} aria-label="새 워크스페이스" onClick={() => setIsCreating(true)}>
          <Icon src={addIcon} size={ICON_SIZE} />
        </button>
        {currentWorkspace && (
          <NavLink to={`/workspaces/${currentWorkspace.workspaceId}/archive`} className={railClass} aria-label="회의록 아카이브">
            <Icon src={archiveIcon} size={ICON_SIZE} />
          </NavLink>
        )}
        <NavLink to="/templates" className={railClass} aria-label="회의록 양식">
          <Icon src={templateIcon} size={ICON_SIZE} />
        </NavLink>
      </div>
      <div className={styles.list}>
        <button
          type="button"
          className={railClass({ isActive: settings.tab !== null })}
          aria-label="설정"
          onClick={() => settings.open('profile')}
        >
          <Icon src={settingsIcon} size={ICON_SIZE} />
        </button>
      </div>
      {/* 새 워크스페이스 만들기 (REQ-031): 피그마 사이드바에 [새 워크스페이스]가 있어 다시 연다 (2026-11-25 사용자 요청) */}
      {isCreating && <CreateWorkspaceModal onClose={() => setIsCreating(false)} />}
    </nav>
  );
}
