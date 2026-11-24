import type { RecordType, TemplateItem } from '../../types/template';
import styles from './TemplateThumbnail.module.css';

// 섹션 정보가 없을 때 그리는 줄 길이 (디자인 Preview)
const FALLBACK_LINES = [32, 56, 48, 56, 40, 24];
// 76x100 종이에 들어갈 만큼만 그린다. 표는 칸 수를 줄여 모양만 보여 준다
const MAX_TABLE_ROWS = 3;
const MAX_TABLE_COLS = 4;
// 섹션 제목 막대 길이를 섹션마다 조금씩 다르게 (모두 같으면 구분이 안 된다)
const TITLE_WIDTHS = ['45%', '60%', '38%', '52%'];

interface TemplateThumbnailProps {
  items?: TemplateItem[];
  /** 회의 기본 정보(일시·장소·참석자) 칸을 켠 양식 */
  showMeetingInfo?: boolean;
}

function SectionBody({ recordType, rows, cols }: { recordType: RecordType; rows: number; cols: number }) {
  if (recordType === 'TABLE') {
    const shownCols = Math.min(Math.max(cols, 1), MAX_TABLE_COLS);
    const cells = Math.min(Math.max(rows, 1), MAX_TABLE_ROWS) * shownCols;
    return (
      <span className={styles.table} style={{ gridTemplateColumns: `repeat(${shownCols}, 1fr)` }}>
        {Array.from({ length: cells }, (_, cell) => (
          <span key={cell} className={[styles.cell, cell < shownCols ? styles.headerCell : ''].filter(Boolean).join(' ')} />
        ))}
      </span>
    );
  }
  const marker = recordType === 'LIST' ? styles.dot : recordType === 'CHECKLIST' ? styles.box : undefined;
  return (
    <span className={styles.lines}>
      {['100%', '72%'].map((width) => (
        <span key={width} className={styles.row}>
          {marker && <span className={marker} />}
          <span className={styles.line} style={{ width }} />
        </span>
      ))}
    </span>
  );
}

/**
 * 양식 고르기 카드의 미리보기 (SCRUM-364, 디자인 요청).
 * 종이 한 장에 양식의 섹션 순서와 기록 방식(자유·목록·체크리스트·표)을 작게 그려 양식끼리 구분되게 한다.
 * 글자는 읽을 수 없는 크기라 그리지 않는다
 */
export default function TemplateThumbnail({ items, showMeetingInfo }: TemplateThumbnailProps) {
  if (!items || items.length === 0) {
    return (
      <span className={`${styles.page} ${styles.fallback}`} aria-hidden="true">
        {FALLBACK_LINES.map((width, line) => (
          <span key={line} className={styles.line} style={{ width }} />
        ))}
      </span>
    );
  }
  return (
    <span className={styles.page} aria-hidden="true">
      <span className={styles.docTitle} />
      {showMeetingInfo && (
        <span className={styles.lines}>
          <span className={styles.infoLine} style={{ width: '64%' }} />
          <span className={styles.infoLine} style={{ width: '48%' }} />
        </span>
      )}
      {items.map(({ title, settings }, index) => (
        <span key={`${title}-${index}`} className={styles.section}>
          <span className={styles.sectionTitle} style={{ width: TITLE_WIDTHS[index % TITLE_WIDTHS.length] }} />
          <SectionBody recordType={settings.recordType} rows={settings.table.rows} cols={settings.table.cols} />
        </span>
      ))}
    </span>
  );
}
