import { useEffect, useRef, type RefObject } from 'react';
import addIcon from '../../assets/icons/menu-add.svg';
// 레거시 (2026-11-25, 피그마 "워크스페이스 바꾸기" 메뉴 아래는 [새 워크스페이스 만들기]. 설정은 ⋮ 메뉴에서 연다)
// import settingsIcon from '../../assets/icons/menu-settings.svg';
import workspaceIcon from '../../assets/icons/menu-workspace.svg';
import Icon from '../../components/Icon';
import menu from '../../components/Menu.module.css';
import type { WorkspaceSummary } from '../../types/workspace';
import styles from './WorkspaceSwitcher.module.css';

const ICON_SIZE = 20;

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  currentId: number;
  anchorRef: RefObject<HTMLElement | null>;
  onSelect: (workspaceId: number) => void;
  /** REQ-031 새 워크스페이스 만들기 창 */
  onCreate: () => void;
  onClose: () => void;
}

/** REQ-029~031 워크스페이스 이름 옆 버튼을 누르면 참여 중인 워크스페이스 목록 (디자인 WorkspaceMenu). 지금 워크스페이스는 강조 */
export default function WorkspaceSwitcher({
  workspaces,
  currentId,
  anchorRef,
  onSelect,
  onCreate,
  onClose,
}: WorkspaceSwitcherProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose]);

  return (
    <div ref={panelRef} className={`${menu.menu} ${styles.panel}`}>
      <ul className={styles.list} aria-label="참여 중인 워크스페이스">
        {workspaces.map((workspace) => {
          const isCurrent = workspace.workspaceId === currentId;
          return (
            <li key={workspace.workspaceId}>
              <button
                type="button"
                className={[menu.item, isCurrent ? menu.selected : ''].filter(Boolean).join(' ')}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onSelect(workspace.workspaceId)}
              >
                <Icon src={workspaceIcon} size={ICON_SIZE} className={menu.itemIcon} />
                {workspace.name}
              </button>
            </li>
          );
        })}
      </ul>
      <div className={menu.divider} />
      {/* 레거시 (2026-11-25, 피그마 "워크스페이스 바꾸기" 메뉴 아래는 [새 워크스페이스 만들기]. 설정은 ⋮ 메뉴에서 연다)
      {onSettings && (
        <button type="button" className={menu.item} onClick={onSettings}>
          <Icon src={settingsIcon} size={ICON_SIZE} className={menu.itemIcon} />
          워크스페이스 설정
        </button>
      )}
      */}
      <button type="button" className={menu.item} onClick={onCreate}>
        <Icon src={addIcon} size={ICON_SIZE} className={menu.itemIcon} />새 워크스페이스 만들기
      </button>
    </div>
  );
}
