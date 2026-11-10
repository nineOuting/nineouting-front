import starIcon from '../../assets/icons/star-fill.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import type { MinutesTemplate } from '../../types/meeting';
import styles from './TemplateGalleryModal.module.css';

const STAR_SIZE = 20;
// 미리보기 속 줄 길이 (디자인 Preview)
const PREVIEW_LINES = [64, 128, 102, 128, 115, 51];

interface TemplateGalleryModalProps {
  templates: MinutesTemplate[];
  selectedId?: string;
  onOpenDetail: (index: number) => void;
  onToggleFavorite: (templateId: string) => void;
  onCreateTemplate: () => void;
  onClose: () => void;
}

/** REQ-100, 123 회의록 양식 전체보기 (디자인 TemplateSelectModal). 카드를 누르면 상세 보기, 별을 누르면 즐겨찾기 */
export default function TemplateGalleryModal({
  templates,
  selectedId,
  onOpenDetail,
  onToggleFavorite,
  onCreateTemplate,
  onClose,
}: TemplateGalleryModalProps) {
  return (
    <Dialog
      title="회의록 양식 선택"
      description="회의 목적에 맞는 양식을 골라 주세요"
      width="md"
      onClose={onClose}
      footer={
        <Button variant="secondary" size="md" onClick={onCreateTemplate}>
          새 양식 만들기
        </Button>
      }
    >
      <ul className={styles.grid}>
        {templates.map((template, index) => {
          const isSelected = template.templateId === selectedId;
          return (
            <li key={template.templateId} className={styles.item}>
              <div className={styles.previewWrap}>
                <button
                  type="button"
                  aria-label={`${template.name} 자세히 보기`}
                  className={[styles.preview, isSelected ? styles.previewSelected : ''].filter(Boolean).join(' ')}
                  onClick={() => onOpenDetail(index)}
                >
                  {PREVIEW_LINES.map((width, line) => (
                    <span key={line} className={styles.line} style={{ width }} />
                  ))}
                </button>
                <button
                  type="button"
                  aria-label={template.isFavorite ? `${template.name} 즐겨찾기 해제` : `${template.name} 즐겨찾기`}
                  aria-pressed={template.isFavorite}
                  className={[styles.star, template.isFavorite ? styles.starOn : ''].filter(Boolean).join(' ')}
                  onClick={() => onToggleFavorite(template.templateId)}
                >
                  <Icon src={starIcon} size={STAR_SIZE} />
                </button>
              </div>
              <p className={[styles.name, isSelected ? styles.nameSelected : ''].filter(Boolean).join(' ')}>
                {template.name}
              </p>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
