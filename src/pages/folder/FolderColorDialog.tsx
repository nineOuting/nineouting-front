import { useState } from 'react';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import { FOLDER_COLORS } from '../../utils/folderColor';
import styles from './FolderColorDialog.module.css';

interface FolderColorDialogProps {
  initialColor: number;
  onSave: (color: number) => Promise<void>;
  onClose: () => void;
}

/** REQ-202 프로젝트 색 설정: 8가지 색 중 하나 (프로젝트 소유자, 워크스페이스 소유자) */
export default function FolderColorDialog({ initialColor, onSave, onClose }: FolderColorDialogProps) {
  const [color, setColor] = useState(initialColor);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(color);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      title="프로젝트 색 설정"
      description="사이드바, 폴더 카드, 회의 날짜, 달력에 이 색이 쓰여요."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button type="button" variant="primary" size="md" isLoading={isSaving} disabled={isSaving} onClick={() => void save()}>
            저장
          </Button>
        </>
      }
    >
      <div className={styles.swatches} role="radiogroup" aria-label="프로젝트 색">
        {FOLDER_COLORS.map(({ label, value }, index) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={color === index}
            aria-label={label}
            className={[styles.swatch, color === index ? styles.selected : ''].filter(Boolean).join(' ')}
            style={{ background: value }}
            onClick={() => setColor(index)}
          />
        ))}
      </div>
    </Dialog>
  );
}
