import { useEffect, useRef, useState, type DragEvent } from 'react';
import dividerTemplateMeta from '../../assets/divider-template-meta.svg';
import Placeholder from '../../components/Placeholder';
import SectionContent from '../../components/SectionContent';
import type { TemplateItem, TemplateLayout } from '../../types/template';
import { CELL_SEPARATOR, PAPER_FONT_SCALE, PX_PER_MM } from '../../utils/templateSettings';
import styles from './TemplatePreview.module.css';

const ICON_SIZE = 16;
const AI_ICON_SIZE = 12;
const PAGE_HEIGHT = 675;
const ZOOM_STEP = 10;
const MIN_ZOOM = 50;
const MAX_ZOOM = 150;
// 디자인 23:419 표 미리보기의 머리 행
const SAMPLE_TABLE_HEADERS = ['No.', '안건', '논의 내용', '비고'];

interface TemplatePreviewProps {
  name: string;
  items: TemplateItem[];
  layout: TemplateLayout;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: (index: number) => void;
}

/** 미리보기 칸 내용: 표는 머리 행, 나머지는 항목 설명 */
function sampleContent(item: TemplateItem) {
  if (item.settings.recordType === 'TABLE') {
    return Array.from({ length: item.settings.table.cols }, (_, col) => SAMPLE_TABLE_HEADERS[col] ?? `열 ${col + 1}`).join(
      CELL_SEPARATOR,
    );
  }
  return item.description;
}

/** 양식 미리보기 (디자인 23:185·23:373). 섹션을 눌러 고르고, 왼쪽 손잡이를 끌어 순서를 바꾼다 */
export default function TemplatePreview({
  name,
  items,
  layout,
  selectedIndex,
  onSelect,
  onMove,
  onAdd,
  onDuplicate,
  onRemove,
}: TemplatePreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const pageHeight = (PAGE_HEIGHT * zoom) / 100;

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      setPageCount(Math.max(1, Math.ceil(paper.getBoundingClientRect().height / pageHeight - 0.01)));
    });
    observer.observe(paper);
    return () => observer.disconnect();
  }, [pageHeight]);

  const goTo = (target: number) => {
    const next = Math.min(pageCount, Math.max(1, target));
    viewportRef.current?.scrollTo({ top: (next - 1) * pageHeight, behavior: 'smooth' });
  };
  const drop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      onMove(dragIndex, index);
    }
    setDragIndex(null);
  };
  const hasSelection = selectedIndex !== null;

  return (
    <section className={styles.panel} aria-label="양식 미리보기">
      <div className={styles.toolbar}>
        <span className={styles.zoom}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="축소"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => value - ZOOM_STEP)}
          >
            <Placeholder size={ICON_SIZE} />
          </button>
          <span className={styles.zoomLabel}>{zoom}%</span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="확대"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => value + ZOOM_STEP)}
          >
            <Placeholder size={ICON_SIZE} />
          </button>
        </span>
        <button type="button" className={styles.iconButton} aria-label="섹션 추가" onClick={onAdd}>
          <Placeholder size={ICON_SIZE} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="고른 섹션 복제" disabled={!hasSelection} onClick={onDuplicate}>
          <Placeholder size={ICON_SIZE} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="고른 섹션 삭제"
          disabled={!hasSelection || items.length <= 1}
          onClick={() => selectedIndex !== null && onRemove(selectedIndex)}
        >
          <Placeholder size={ICON_SIZE} />
        </button>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        onScroll={(event) => setPage(Math.min(pageCount, Math.floor(event.currentTarget.scrollTop / pageHeight + 0.5) + 1))}
      >
        <div
          ref={paperRef}
          className={styles.paper}
          style={{
            zoom: zoom / 100,
            padding: `${layout.marginVerticalMm * PX_PER_MM}px ${layout.marginHorizontalMm * PX_PER_MM}px`,
          }}
        >
          {layout.header.enabled && layout.header.text && <p className={styles.edge}>{layout.header.text}</p>}
          <div className={styles.head} style={{ justifyContent: layout.align === 'CENTER' ? 'center' : undefined }}>
            <div className={styles.names} style={{ textAlign: layout.align.toLowerCase() as 'left' | 'center' | 'right' }}>
              <p className={styles.brand}>Sync</p>
              <p className={styles.name}>{name || '양식 이름'}</p>
            </div>
            {layout.showMeetingInfo && (
              <div className={styles.metaBlock}>
                <img src={dividerTemplateMeta} alt="" width={32} height={72} className={styles.metaDivider} />
                <div className={styles.meta}>
                  <p>일시 : 2026. 10. 19 (월) 14:00 - 15:00</p>
                  <p>장소 : 회의실 A</p>
                  <p className={styles.attendees}>
                    <Placeholder size={ICON_SIZE} />
                    참석자 이름 (총 5명)
                  </p>
                </div>
              </div>
            )}
          </div>

          <ol className={styles.sections} style={{ gap: layout.sectionGap }}>
            {items.map((item, index) => {
              const isSelected = index === selectedIndex;
              const titleStyle = { fontSize: item.settings.titleSize * PAPER_FONT_SCALE, color: item.settings.color };
              return (
                <li
                  key={index}
                  className={[styles.row, isSelected ? styles.selectedRow : '', dragIndex === index ? styles.dragging : '']
                    .filter(Boolean)
                    .join(' ')}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => drop(event, index)}
                >
                  <span
                    className={styles.handle}
                    draggable
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.title} 순서 바꾸기 (끌어서 옮기기, 위·아래 화살표)`}
                    onDragStart={() => setDragIndex(index)}
                    onDragEnd={() => setDragIndex(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' && index > 0) {
                        event.preventDefault();
                        onMove(index, index - 1);
                      } else if (event.key === 'ArrowDown' && index < items.length - 1) {
                        event.preventDefault();
                        onMove(index, index + 1);
                      }
                    }}
                  >
                    <Placeholder size={ICON_SIZE} />
                  </span>
                  <div
                    className={[styles.card, isSelected ? styles.cardSelected : ''].filter(Boolean).join(' ')}
                    style={{ marginTop: item.settings.margin / 2 }}
                    onClick={() => onSelect(index)}
                  >
                    <div className={styles.cardHead}>
                      <button type="button" className={styles.cardTitle} style={titleStyle} aria-pressed={isSelected}>
                        <Placeholder size={ICON_SIZE} />
                        {item.title}
                      </button>
                      {isSelected ? (
                        <span className={styles.cardTools}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={`${item.title} 위로`}
                            disabled={index === 0}
                            onClick={(event) => {
                              event.stopPropagation();
                              onMove(index, index - 1);
                            }}
                          >
                            <Placeholder size={ICON_SIZE} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={`${item.title} 아래로`}
                            disabled={index === items.length - 1}
                            onClick={(event) => {
                              event.stopPropagation();
                              onMove(index, index + 1);
                            }}
                          >
                            <Placeholder size={ICON_SIZE} />
                          </button>
                          {/* REQ-101 AI 초안이 생기면 연결한다 (docs/backlog.md) */}
                          <button type="button" className={styles.ai} disabled title="AI 정리는 준비 중이에요">
                            <Placeholder size={AI_ICON_SIZE} />
                            AI 정리
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label={`${item.title} 삭제`}
                          disabled={items.length <= 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove(index);
                          }}
                        >
                          <Placeholder size={ICON_SIZE} />
                        </button>
                      )}
                    </div>
                    <div className={styles.cardBody}>
                      <SectionContent
                        settings={item.settings}
                        content={sampleContent(item)}
                        label={item.title}
                        placeholder="설명을 적으면 이곳에 보여요"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {layout.footer.enabled && layout.footer.text && <p className={`${styles.edge} ${styles.footer}`}>{layout.footer.text}</p>}
          {layout.pageNumber && <p className={styles.pageNumber}>- 1 -</p>}
        </div>
      </div>

      <div className={styles.pager}>
        <button type="button" className={styles.iconButton} aria-label="이전 쪽" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          <Placeholder size={ICON_SIZE} />
        </button>
        <span className={styles.pageLabel}>
          {page}/{pageCount}
        </span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="다음 쪽"
          disabled={page >= pageCount}
          onClick={() => goTo(page + 1)}
        >
          <Placeholder size={ICON_SIZE} />
        </button>
      </div>
    </section>
  );
}
