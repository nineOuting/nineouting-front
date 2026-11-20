import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import type { MinutesTemplate } from '../../types/meeting';
import styles from './TemplateDetailModal.module.css';

// 미리보기 속 줄 길이 (디자인 Preview Line)
const PREVIEW_LINES = [110, 220, 187, 220, 154, 220, 198, 88, 220, 132];
const ICON_SIZE = 24;

interface TemplateDetailModalProps {
  templates: MinutesTemplate[];
  index: number;
  onChangeIndex: (index: number) => void;
  /** 없으면 보기만 한다 (참석자가 아니면, REQ-130) */
  onUse?: (templateId: number) => void;
  /** X: 창을 모두 닫는다 */
  onClose: () => void;
  /** [목록으로]: 양식 목록 창으로 돌아간다 */
  onBack: () => void;
}

/** REQ-123 회의록 양식 상세 보기 (디자인 TemplateDetail). 좌우 버튼으로 다른 양식을 넘겨 본다 */
export default function TemplateDetailModal({ templates, index, onChangeIndex, onUse, onClose, onBack }: TemplateDetailModalProps) {
  const template = templates[index];
  const lastIndex = templates.length - 1;

  return (
    <Dialog
      title={template.name}
      // 디자인 TemplateDetailModal: 부제는 양식 설명, 쪽 표시는 미리보기 아래 (디자인 체크 2026-11-19)
      description={template.description || undefined}
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onBack}>
            목록으로
          </Button>
          {onUse && (
            <Button size="md" onClick={() => onUse(template.templateId)}>
              이 양식 사용하기
            </Button>
          )}
        </>
      }
    >
      <div className={styles.previewRow}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="이전 양식"
          disabled={index === 0}
          onClick={() => onChangeIndex(index - 1)}
        >
          <Icon src={chevronLeftIcon} size={ICON_SIZE} />
        </button>
        {/* 디자인 Preview 260x340 세로 쪽. 양식 미리보기 이미지는 양식 관리(REQ-119) 연동 때 채운다 */}
        <div className={styles.preview}>
          {PREVIEW_LINES.map((width, line) => (
            <span key={line} className={styles.line} style={{ width }} />
          ))}
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="다음 양식"
          disabled={index === lastIndex}
          onClick={() => onChangeIndex(index + 1)}
        >
          <Icon src={chevronRightIcon} size={ICON_SIZE} />
        </button>
      </div>
      <p className={styles.pageBadgeRow}>
        <span className={styles.pageBadge}>
          {index + 1} / {templates.length}
        </span>
      </p>
    </Dialog>
  );
}
