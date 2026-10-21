import { useId } from 'react';
import addIcon from '../../assets/add.svg';
import starIcon from '../../assets/star.svg';
import Modal from '../../components/Modal';
import Placeholder from '../../components/Placeholder';
import type { MinutesTemplate } from '../../types/meeting';
import styles from './TemplateGalleryModal.module.css';

const TITLE_ICON_SIZE = 24;

interface TemplateGalleryModalProps {
  templates: MinutesTemplate[];
  selectedId?: string;
  onOpenDetail: (index: number) => void;
  onToggleFavorite: (templateId: string) => void;
  onCreateTemplate: () => void;
  onClose: () => void;
}

/** REQ-100, 123 회의록 양식 전체보기. 카드를 누르면 상세 보기, 별을 누르면 즐겨찾기 */
export default function TemplateGalleryModal({
  templates,
  selectedId,
  onOpenDetail,
  onToggleFavorite,
  onCreateTemplate,
  onClose,
}: TemplateGalleryModalProps) {
  const titleId = useId();

  return (
    <Modal labelledBy={titleId} onClose={onClose} closeOnDimClick className={styles.card}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.titleRow}>
            <Placeholder size={TITLE_ICON_SIZE} />
            <h2 id={titleId} className={styles.title}>
              회의록 양식 선택
            </h2>
          </div>
          <p className={styles.caption}>회의 목적에 맞는 회의록 양식을 선택해 주세요</p>
        </div>
        <button type="button" className={styles.createButton} onClick={onCreateTemplate}>
          새 양식 만들기
          <img src={addIcon} alt="" width={13} height={14} />
        </button>
      </div>
      <ul className={styles.grid}>
        {templates.map((template, index) => (
          <li key={template.templateId} className={styles.item}>
            <div className={styles.previewWrap}>
              <button
                type="button"
                aria-label={`${template.name} 자세히 보기`}
                className={[styles.preview, template.templateId === selectedId ? styles.previewSelected : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onOpenDetail(index)}
              />
              <button
                type="button"
                aria-label={template.isFavorite ? `${template.name} 즐겨찾기 해제` : `${template.name} 즐겨찾기`}
                aria-pressed={template.isFavorite}
                className={[styles.star, template.isFavorite ? '' : styles.starOff].filter(Boolean).join(' ')}
                onClick={() => onToggleFavorite(template.templateId)}
              >
                <img src={starIcon} alt="" width={22} height={22} />
              </button>
            </div>
            <p className={styles.name}>{template.name}</p>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
