import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { listMyWorkspaces } from '../api/workspace';
import addIcon from '../assets/icons/add.svg';
import archiveIcon from '../assets/icons/archive.svg';
import helpIcon from '../assets/icons/help.svg';
import homeIcon from '../assets/icons/home.svg';
import settingsIcon from '../assets/icons/settings.svg';
import expandIcon from '../assets/icons/sidebar-collapse.svg';
import templateIcon from '../assets/icons/template.svg';
import workspaceIcon from '../assets/icons/workspace.svg';
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
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
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
        <NavLink to="/help" className={railClass} aria-label="도움말">
          <Icon src={helpIcon} size={ICON_SIZE} />
        </NavLink>
        <NavLink to="/settings" className={railClass} aria-label="설정">
          <Icon src={settingsIcon} size={ICON_SIZE} />
        </NavLink>
      </div>
      {isCreating && <CreateWorkspaceModal onClose={() => setIsCreating(false)} />}
    </nav>
  );
}
