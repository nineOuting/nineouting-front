import { useEffect, useRef, type RefObject } from 'react';
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
}

/**
 * 입력 칸 아래에 뜨는 선택 목록. 디자인에 목록 모양이 없어 칸 모양에 맞춰 간단히 만들었다.
 * 부모는 position: relative 여야 한다.
 */
export default function DropdownMenu({ items, emptyText, label, anchorRef, onSelect, onClose }: DropdownMenuProps) {
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
    <ul ref={listRef} role="listbox" aria-label={label} className={styles.menu}>
      {items.length === 0 && <li className={styles.empty}>{emptyText}</li>}
      {items.map((item) => (
        <li key={item.id} role="option" aria-selected={Boolean(item.isSelected)}>
          <button
            type="button"
            className={[styles.item, item.isSelected ? styles.selected : ''].filter(Boolean).join(' ')}
            onClick={() => onSelect(item.id)}
          >
            <span>{item.label}</span>
            {item.description && <span className={styles.description}>{item.description}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
