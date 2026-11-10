import { useEffect, useRef, type RefObject } from 'react';
import menu from './Menu.module.css';
import styles from './DropdownMenu.module.css';

export interface DropdownItem {
  id: string;
  label: string;
  description?: string;
  isSelected?: boolean;
}

interface DropdownMenuProps {
  items: DropdownItem[];
  emptyText: string;
  label: string;
  /** 바깥 클릭으로 닫을 때 제외할 영역(목록을 연 버튼) */
  anchorRef: RefObject<HTMLElement | null>;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** 여는 버튼이 좁을 때 목록 너비 등을 덧붙인다 */
  className?: string;
}

/** 입력 칸 아래에 뜨는 선택 목록 (디자인 Menu). 부모는 position: relative 여야 한다 */
export default function DropdownMenu({
  items,
  emptyText,
  label,
  anchorRef,
  onSelect,
  onClose,
  className,
}: DropdownMenuProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
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
    <ul ref={listRef} role="listbox" aria-label={label} className={[menu.menu, styles.menu, className].filter(Boolean).join(' ')}>
      {items.length === 0 && <li className={menu.empty}>{emptyText}</li>}
      {items.map((item) => (
        <li key={item.id} role="option" aria-selected={Boolean(item.isSelected)}>
          <button
            type="button"
            className={[menu.item, item.isSelected ? menu.selected : ''].filter(Boolean).join(' ')}
            onClick={() => onSelect(item.id)}
          >
            <span className={menu.texts}>
              <span>{item.label}</span>
              {item.description && <span className={menu.description}>{item.description}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
