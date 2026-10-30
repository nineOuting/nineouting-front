import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import styles from './Popover.module.css';

interface PopoverProps {
  label: string;
  /** 바깥 클릭으로 닫을 때 제외할 영역(창을 연 버튼) */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/** 버튼 아래에 뜨는 흰 창 (아카이브 필터 등). 바깥을 누르거나 Esc로 닫는다. 부모는 position: relative 여야 한다 */
export default function Popover({ label, anchorRef, onClose, children, className }: PopoverProps) {
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
    <div ref={panelRef} role="dialog" aria-label={label} className={[styles.popover, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
