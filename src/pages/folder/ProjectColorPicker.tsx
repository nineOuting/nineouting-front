import { useEffect, useRef } from 'react';
import { FOLDER_COLORS, folderColor } from '../../utils/folderColor';
import styles from './ProjectColorPicker.module.css';

interface ProjectColorPickerProps {
  color: number;
  onPick: (color: number) => void;
  onClose: () => void;
}

/**
 * REQ-202 디자인 ProjectColorPicker: ⋮ 메뉴 [프로젝트 색 설정]으로 연다. 고르면 바로 바뀌고 토스트는 없다.
 * 프로젝트 소유자, 워크스페이스 소유자만
 */
export default function ProjectColorPicker({ color, onPick, onClose }: ProjectColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={styles.picker} role="dialog" aria-label="프로젝트 색">
      <p className={styles.title}>프로젝트 색</p>
      <div className={styles.swatches} role="radiogroup" aria-label="프로젝트 색">
        {FOLDER_COLORS.map(({ key, label }, index) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={color === index}
            aria-label={label}
            className={[styles.swatch, color === index ? styles.selected : ''].filter(Boolean).join(' ')}
            style={{ background: folderColor(index) }}
            onClick={() => onPick(index)}
          />
        ))}
      </div>
      <p className={styles.caption}>사이드바, 폴더 카드, 달력에 같이 적용돼요</p>
    </div>
  );
}
