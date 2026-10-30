import { useId } from 'react';
import Modal from '../../components/Modal';
import Placeholder from '../../components/Placeholder';
import type { MinutesTemplate } from '../../types/meeting';
import styles from './TemplateDetailModal.module.css';

const ICON_SIZE = 24;

interface TemplateDetailModalProps {
  templates: MinutesTemplate[];
  index: number;
  onChangeIndex: (index: number) => void;
  onUse: (templateId: string) => void;
  onClose: () => void;
}

/** REQ-100 회의록 양식 상세 보기. 좌우 버튼으로 다른 양식을 넘겨 본다 */
export default function TemplateDetailModal({ templates, index, onChangeIndex, onUse, onClose }: TemplateDetailModalProps) {
  const titleId = useId();
  const template = templates[index];
  const lastIndex = templates.length - 1;

  return (
    <Modal labelledBy={titleId} onClose={onClose} className={styles.card}>
      <div className={styles.closeRow}>
        <button type="button" className={styles.iconButton} aria-label="닫기" onClick={onClose}>
          <Placeholder size={ICON_SIZE} />
        </button>
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <Placeholder size={ICON_SIZE} />
          <h2 id={titleId} className={styles.title}>
            {template.name}
          </h2>
        </div>
        <div className={styles.previewRow}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="이전 양식"
            disabled={index === 0}
            onClick={() => onChangeIndex(index - 1)}
          >
            <Placeholder size={ICON_SIZE} />
          </button>
          {/* 양식 미리보기 이미지는 양식 관리(REQ-119) 연동 때 채운다 */}
          <div className={styles.preview} />
          <button
            type="button"
            className={styles.iconButton}
            aria-label="다음 양식"
            disabled={index === lastIndex}
            onClick={() => onChangeIndex(index + 1)}
          >
            <Placeholder size={ICON_SIZE} />
          </button>
        </div>
        <span className={styles.pager}>
          {index + 1}/{templates.length}
        </span>
        <button type="button" className={styles.useButton} onClick={() => onUse(template.templateId)}>
          이 양식 사용하기
        </button>
      </div>
    </Modal>
  );
}
