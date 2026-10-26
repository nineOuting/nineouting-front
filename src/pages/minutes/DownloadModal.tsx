import { useState } from 'react';
import type { ExportFormat } from '../../api/minutes';
import radioChecked from '../../assets/radio-checked.svg';
import Modal from '../../components/Modal';
import Placeholder from '../../components/Placeholder';
import styles from './MinutesModal.module.css';

const TITLE_ICON_SIZE = 24;
const FORMAT_ICON_SIZE = 34;
const BUTTON_ICON_SIZE = 16;
const RADIO_SIZE = 18;

// 디자인 문구 그대로 (두 형식 모두 같은 설명)
const FORMATS: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'PDF', label: 'PDF', description: '가장 보편적인 형식으로, 인쇄 및 공유에 적합해요' },
  { value: 'DOCX', label: '.docx', description: '가장 보편적인 형식으로, 인쇄 및 공유에 적합해요' },
];

interface DownloadModalProps {
  isDownloading: boolean;
  onDownload: (format: ExportFormat) => void;
  onClose: () => void;
}

/** REQ-137 다운로드 (디자인 23:550). 기본은 PDF */
export default function DownloadModal({ isDownloading, onDownload, onClose }: DownloadModalProps) {
  const [format, setFormat] = useState<ExportFormat>('PDF');

  return (
    <Modal labelledBy="download-title" onClose={onClose} closeOnDimClick className={styles.modal}>
      <div className={styles.head}>
        <h2 id="download-title" className={styles.title}>
          <Placeholder size={TITLE_ICON_SIZE} />
          다운로드
        </h2>
        <p className={styles.description}>회의록을 파일로 다운로드 할 수 있습니다</p>
      </div>
      <div className={styles.formats} role="radiogroup" aria-label="파일 형식">
        {FORMATS.map((option) => {
          const isSelected = format === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={[styles.format, isSelected ? styles.formatSelected : ''].filter(Boolean).join(' ')}
              onClick={() => setFormat(option.value)}
            >
              <Placeholder size={FORMAT_ICON_SIZE} />
              <span className={styles.formatText}>
                <span className={styles.formatLabel}>{option.label}</span>
                <span className={styles.formatDescription}>{option.description}</span>
              </span>
              {isSelected ? (
                <img src={radioChecked} alt="" width={RADIO_SIZE} height={RADIO_SIZE} />
              ) : (
                <span className={styles.radio} />
              )}
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.primary} disabled={isDownloading} onClick={() => onDownload(format)}>
        <Placeholder size={BUTTON_ICON_SIZE} />
        {isDownloading ? '파일을 만드는 중...' : '다운로드'}
      </button>
    </Modal>
  );
}
