import { useEffect, useRef, type RefObject } from 'react';
import Icon from '../../components/Icon';
import menu from '../../components/Menu.module.css';
import styles from './ActionMenu.module.css';

const ICON_SIZE = 20;

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  /** src/assets/icons 아이콘 */
  icon?: string;
  /** 삭제처럼 되돌릴 수 없는 일은 빨간 글자 */
  isDanger?: boolean;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  /** 바깥 클릭으로 닫을 때 제외할 영역(메뉴를 연 버튼) */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  className?: string;
}

/** 더보기 버튼 아래 작은 메뉴 (디자인 FolderMenu). 부모는 position: relative */
export default function ActionMenu({ label, items, anchorRef, onClose, className }: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
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
    <div ref={menuRef} role="menu" aria-label={label} className={[menu.menu, styles.menu, className].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={[menu.item, item.isDanger ? menu.danger : ''].filter(Boolean).join(' ')}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.icon && <Icon src={item.icon} size={ICON_SIZE} className={menu.itemIcon} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
