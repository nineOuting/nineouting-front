import type { TemplateItem } from '../types/template';
import { blankContent } from '../utils/templateSample';
import { MAX_ITEM_DESCRIPTION_LENGTH, PAPER_FONT_SCALE } from '../utils/templateSettings';
import SectionContent from './SectionContent';
import styles from './TemplateSectionBlank.module.css';

// 결정 사항 섹션만 "결정된 내용", 다른 목록 섹션(미결 안건, 목록형 커스텀 항목)은 "내용"
const DECISION_PRESET = '결정 사항';

interface TemplateSectionBlankProps {
  item: TemplateItem;
  /** 설명이 비었을 때 보여 줄 안내 (양식 편집 미리보기). 없으면 설명 줄을 그리지 않는다 */
  emptyDescription?: string;
  /** 있으면 설명 줄을 그 자리에서 고친다 (양식 편집 미리보기에서 고른 섹션만, SCRUM-430) */
  onChangeDescription?: (description: string) => void;
}

/**
 * 양식 미리보기의 섹션 내용 (SCRUM-410 디자인 요청). 예시 내용은 비우고 제목 아래 회색 설명 한 줄과 기록 방식 모양만 보여 준다.
 * 줄글은 설명만, 목록은 "• 결정된 내용", 체크리스트는 "☐ 할 일 · 담당자 · 기한" 회색 한 줄, 표는 머리 행과 빈 칸.
 * 양식 편집 미리보기·양식 목록 카드·양식 상세 창이 같이 쓴다
 */
export default function TemplateSectionBlank({ item, emptyDescription, onChangeDescription }: TemplateSectionBlankProps) {
  const { settings } = item;
  const description = item.description.trim();
  const lineStyle = { fontSize: settings.bodySize * PAPER_FONT_SCALE };

  return (
    <div className={styles.blank}>
      {onChangeDescription ? (
        // 같은 회색 한 줄 모양 그대로 고친다. 길어지면 줄이 늘어난다
        <textarea
          data-edit="description"
          className={`${styles.description} ${styles.descriptionInput}`}
          aria-label={`${item.title} AI에게 알려 줄 설명`}
          rows={1}
          maxLength={MAX_ITEM_DESCRIPTION_LENGTH}
          placeholder={emptyDescription}
          value={item.description}
          onChange={(event) => onChangeDescription(event.target.value)}
        />
      ) : description ? (
        <p className={styles.description}>{description}</p>
      ) : (
        emptyDescription && <p className={`${styles.description} ${styles.emptyDescription}`}>{emptyDescription}</p>
      )}
      {settings.recordType === 'LIST' && (
        <p className={styles.line} style={lineStyle}>
          <span aria-hidden="true">•</span>
          {settings.preset === DECISION_PRESET || item.title === DECISION_PRESET ? '결정된 내용' : '내용'}
        </p>
      )}
      {settings.recordType === 'CHECKLIST' && (
        <p className={styles.line} style={lineStyle}>
          <span className={styles.box} aria-hidden="true" />
          할 일 · 담당자 · 기한
        </p>
      )}
      {settings.recordType === 'TABLE' && <SectionContent settings={settings} content={blankContent(item)} label={item.title} />}
    </div>
  );
}
