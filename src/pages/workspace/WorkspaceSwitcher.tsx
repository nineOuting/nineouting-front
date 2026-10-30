import { useEffect, useRef, type RefObject } from 'react';
import Placeholder from '../../components/Placeholder';
import type { WorkspaceSummary } from '../../types/workspace';
import styles from './WorkspaceSwitcher.module.css';

const ICON_SIZE = 16;

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  currentId: number;
  anchorRef: RefObject<HTMLElement | null>;
  onSelect: (workspaceId: number) => void;
  onCreate: () => void;
  onClose: () => void;
}

/** REQ-029~031 워크스페이스 이름 옆 버튼을 누르면 참여 중인 워크스페이스 목록. 지금 워크스페이스는 강조 */
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
    <div ref={panelRef} className={styles.panel}>
      <ul className={styles.list} aria-label="참여 중인 워크스페이스">
        {workspaces.map((workspace) => {
          const isCurrent = workspace.workspaceId === currentId;
          return (
            <li key={workspace.workspaceId}>
              <button
                type="button"
                className={[styles.item, isCurrent ? styles.current : ''].filter(Boolean).join(' ')}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onSelect(workspace.workspaceId)}
              >
                <Placeholder size={ICON_SIZE} />
                {workspace.name}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className={styles.create} onClick={onCreate}>
        <Placeholder size={ICON_SIZE} />새 워크스페이스 만들기
      </button>
    </div>
  );
}
