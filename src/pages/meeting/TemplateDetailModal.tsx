import { useEffect, useRef, useState } from 'react';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import type { MinutesTemplate } from '../../types/meeting';
import styles from './TemplateDetailModal.module.css';
import TemplatePaper, { PAPER_PAGE_HEIGHT } from './TemplatePaper';

// 미리보기 속 줄 길이 (디자인 Preview Line)
const PREVIEW_LINES = [110, 220, 187, 220, 154, 220, 198, 88, 220, 132];
const ICON_SIZE = 24;
// 미리보기 칸 340px에서 테두리 1px씩을 뺀 높이. 종이 한 쪽이 이 높이에 꼭 맞게 줄인다
const PAGE_BOX_HEIGHT = 338;
const PAPER_SCALE = PAGE_BOX_HEIGHT / PAPER_PAGE_HEIGHT;

interface TemplateDetailModalProps {
  templates: MinutesTemplate[];
  index: number;
  /** 없으면 보기만 한다 (참석자가 아니면, REQ-130) */
  onUse?: (templateId: number) => void;
  /** X: 창을 모두 닫는다 */
  onClose: () => void;
  /** [목록으로]: 양식 목록 창으로 돌아간다 */
  onBack: () => void;
}

/**
 * REQ-123 회의록 양식 상세 보기 (디자인 TemplateDetail). 종이 한 쪽씩 보여 주고 좌우 버튼으로 쪽을 넘긴다 (SCRUM-364, 디자인 요청).
 * 쪽은 양식 편집 미리보기처럼 종이를 한 쪽 높이씩 잘라 보여 준다. 다른 양식은 [목록으로]에서 고른다
 */
export default function TemplateDetailModal({ templates, index, onUse, onClose, onBack }: TemplateDetailModalProps) {
  const template = templates[index];
  const hasPaper = Boolean(template.items && template.layout);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      setPageCount(Math.max(1, Math.ceil(sheet.getBoundingClientRect().height / PAGE_BOX_HEIGHT - 0.01)));
    });
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [hasPaper]);

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
          aria-label="이전 쪽"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          <Icon src={chevronLeftIcon} size={ICON_SIZE} />
        </button>
        {/* 디자인 Preview 260x340. 양식 정보가 있으면 실제 회의록 종이를 예시 내용으로 채워 한 쪽씩 보여 준다 */}
        {template.items && template.layout ? (
          <div className={`${styles.preview} ${styles.previewPaper}`}>
            <div
              ref={sheetRef}
              className={styles.sheet}
              style={{ transform: `translateY(-${(page - 1) * PAGE_BOX_HEIGHT}px)` }}
            >
              <TemplatePaper name={template.name} items={template.items} layout={template.layout} scale={PAPER_SCALE} />
            </div>
          </div>
        ) : (
          <div className={styles.preview}>
            {PREVIEW_LINES.map((width, line) => (
              <span key={line} className={styles.line} style={{ width }} />
            ))}
          </div>
        )}
        <button
          type="button"
          className={styles.iconButton}
          aria-label="다음 쪽"
          disabled={page >= pageCount}
          onClick={() => setPage((value) => value + 1)}
        >
          <Icon src={chevronRightIcon} size={ICON_SIZE} />
        </button>
      </div>
      <p className={styles.pageBadgeRow}>
        <span className={styles.pageBadge}>
          {page} / {pageCount}
        </span>
      </p>
    </Dialog>
  );
}
