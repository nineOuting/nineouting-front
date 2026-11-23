import { useState, type RefObject } from 'react';
import Checkbox from '../../components/Checkbox';
import Popover from '../../components/Popover';
import { folderColor } from '../../utils/folderColor';
import styles from './ProjectFilter.module.css';

export interface FolderOption {
  folderId: number;
  label: string;
  /** REQ-202 프로젝트 색 번호 */
  color?: number;
}

interface ProjectFilterProps {
  folders: FolderOption[];
  /** 고른 폴더. null이면 전체 */
  selected: number[] | null;
  anchorRef: RefObject<HTMLElement | null>;
  onApply: (selected: number[] | null) => void;
  onClose: () => void;
}

/**
 * REQ-147 홈 달력 프로젝트 필터 (피그마 ProjectFilterPopover 2419:51044, 2419:51090).
 * 체크박스로 여러 폴더를 고르고 [적용]. 상자 색은 폴더 색
 */
export default function ProjectFilter({ folders, selected, anchorRef, onApply, onClose }: ProjectFilterProps) {
  const [checked, setChecked] = useState<number[]>(() => selected ?? folders.map(({ folderId }) => folderId));
  const isAll = folders.length > 0 && folders.every(({ folderId }) => checked.includes(folderId));

  const toggle = (folderId: number) =>
    setChecked((prev) => (prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]));

  return (
    <Popover label="프로젝트로 거르기" anchorRef={anchorRef} onClose={onClose} className={styles.popover}>
      {folders.length === 0 ? (
        <p className={styles.empty}>프로젝트 폴더가 없어요</p>
      ) : (
        <div className={styles.list}>
          {/* 전체는 꺼져 있어도 파란 테두리 (피그마 2419:51090) */}
          <Checkbox
            checked={isAll}
            boxColor="var(--control-track-on-secondary)"
            onChange={() => setChecked(isAll ? [] : folders.map(({ folderId }) => folderId))}>
            <span className={styles.label}>전체 프로젝트</span>
          </Checkbox>
          <hr className={styles.divider} />
          {folders.map(({ folderId, label, color }) => (
            <Checkbox
              key={folderId}
              checked={checked.includes(folderId)}
              boxColor={folderColor(color)}
              onChange={() => toggle(folderId)}
            >
              <span className={styles.label}>{label}</span>
            </Checkbox>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className={styles.apply}
          disabled={checked.length === 0}
          onClick={() => onApply(isAll ? null : checked)}
        >
          적용
        </button>
      </div>
    </Popover>
  );
}
