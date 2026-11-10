import { useState } from 'react';
import type { ExportFormat } from '../../api/minutes';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import styles from './MinutesModal.module.css';

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'PDF', label: 'PDF' },
  { value: 'DOCX', label: '.docx' },
];

interface DownloadModalProps {
  isDownloading: boolean;
  onDownload: (format: ExportFormat) => void;
  onClose: () => void;
}

/** REQ-137 다운로드 (디자인 MinutesEditorPage_DownloadFormat). 기본은 PDF */
export default function DownloadModal({ isDownloading, onDownload, onClose }: DownloadModalProps) {
  const [format, setFormat] = useState<ExportFormat>('PDF');

  return (
    <Dialog
      title="회의록 다운로드"
      description="다운로드할 파일 형식을 선택해 주세요."
      hideClose
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button size="md" disabled={isDownloading} onClick={() => onDownload(format)}>
            {isDownloading ? '파일을 만드는 중' : '다운로드'}
          </Button>
        </>
      }
    >
      <div className={styles.formats} role="radiogroup" aria-label="파일 형식">
        {FORMATS.map((option) => (
          <label key={option.value} className={styles.format}>
            <input
              type="radio"
              name="export-format"
              className={styles.radio}
              checked={format === option.value}
              onChange={() => setFormat(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </Dialog>
  );
}
