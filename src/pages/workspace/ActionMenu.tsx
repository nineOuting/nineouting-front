import { Fragment, useEffect, useRef, type RefObject } from 'react';
import dividerMenu from '../../assets/divider-menu.svg';
import styles from './ActionMenu.module.css';

const DIVIDER_WIDTH = 84;

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  /** 바깥 클릭으로 닫을 때 제외할 영역(메뉴를 연 버튼) */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/** 더보기 버튼 아래 작은 메뉴 (폴더 카드: 이름 바꾸기·폴더 삭제). 부모는 position: relative */
export default function ActionMenu({ label, items, anchorRef, onClose }: ActionMenuProps) {
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
    <div ref={menuRef} role="menu" aria-label={label} className={styles.menu}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && <img src={dividerMenu} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />}
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
