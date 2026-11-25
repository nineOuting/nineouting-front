import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import deleteIcon from '../../assets/icons/delete-sm.svg';
import dragIcon from '../../assets/icons/drag.svg';
import zoomInIcon from '../../assets/icons/zoom-in.svg';
import zoomOutIcon from '../../assets/icons/zoom-out.svg';
import Icon from '../../components/Icon';
import SectionContent from '../../components/SectionContent';
import type { TemplateItem, TemplateLayout } from '../../types/template';
import { SAMPLE_MEETING_INFO, blankContent } from '../../utils/templateSample';
import { A4_HEIGHT_PX, A4_WIDTH_PX, DEFAULT_PAPER_ZOOM, PAPER_FONT_SCALE, PX_PER_MM } from '../../utils/templateSettings';
import styles from './TemplatePreview.module.css';

const ICON_SIZE = 16;
// 실제 A4 크기 종이 (SCRUM-410)
const PAGE_HEIGHT = A4_HEIGHT_PX;
const PAPER_WIDTH = A4_WIDTH_PX;
// 종이 안 칸 사이 간격 (.paper gap)
const PAPER_GAP = 10;
const DEFAULT_ZOOM = DEFAULT_PAPER_ZOOM;
const ZOOM_STEP = 10;
const MIN_ZOOM = 50;
const MAX_ZOOM = 150;
// QA 70 순서를 바꾸면 다른 섹션이 미끄러지듯 자리를 옮긴다
const MOVE_MS = 200;

/** 손잡이로 끄는 중인 섹션. top, height는 끌기 시작할 때 화면 위치 (확대율이 들어간 px) */
interface DragState {
  from: number;
  to: number;
  startY: number;
  dy: number;
  tops: number[];
  heights: number[];
  /** 섹션 사이 거리 (끄는 섹션 높이 + 간격): 비켜 주는 섹션이 이만큼 움직인다 */
  step: number;
  scale: number;
}

interface TemplatePreviewProps {
  name: string;
  items: TemplateItem[];
  layout: TemplateLayout;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}

/** 쪽마다 들어가는 섹션 번호. 아직 재지 않은 섹션은 마지막 쪽에 둔다 */
function normalizePages(pages: number[][], count: number) {
  const seen = new Set<number>();
  const result = pages.map((indices) =>
    indices.filter((index) => {
      if (index >= count || seen.has(index)) {
        return false;
      }
      seen.add(index);
      return true;
    }),
  );
  const rest = Array.from({ length: count }, (_, index) => index).filter((index) => !seen.has(index));
  const filled = result.filter((indices) => indices.length > 0);
  if (filled.length === 0) {
    return [rest];
  }
  filled[filled.length - 1].push(...rest);
  return filled;
}

/**
 * 양식 미리보기 (피그마 프론트 TemplateEditorPage). 실제 회의록 종이처럼 양식 이름, 회의 기본 정보, 섹션마다 예시 내용을 보여 준다.
 * 섹션을 눌러 고르고, 바깥 손잡이를 끌어 순서를 바꾼다. 미리보기라 제목·설명은 여기서 고치지 않고
 * 왼쪽 항목 구성 패널에서만 고친다 (디자인 09 11/25, SCRUM-410).
 * QA 73 한 쪽에 다 들어가지 않으면 섹션 단위로 다음 쪽 종이로 넘긴다 (한 쪽보다 긴 섹션은 그 쪽에 혼자 둔다)
 */
export default function TemplatePreview({
  name,
  items,
  layout,
  selectedIndex,
  onSelect,
  onMove,
  onRemove,
}: TemplatePreviewProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pageState, setPageState] = useState<number[][]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [, setMeasureTick] = useState(0);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const firstPaperRef = useRef<HTMLDivElement>(null);
  const edgeHeadRef = useRef<HTMLParagraphElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const edgeFootRef = useRef<HTMLParagraphElement>(null);
  const numberRef = useRef<HTMLParagraphElement>(null);
  // 고르지 않았을 때 섹션 높이 (섹션 제목별). 고른 섹션은 편집 칸 때문에 커지므로 이 높이로 쪽을 나눈다
  const restHeightRef = useRef(new Map<string, number>());
  const selectedTitleRef = useRef<{ index: number; title: string } | null>(null);
  // 순서를 바꾸기 직전 섹션 위치 (움직임을 그리려고)
  const flipRef = useRef<{ tops: number[]; order: number[] } | null>(null);

  const pages = normalizePages(pageState, items.length);
  const pageCount = pages.length;

  // 글을 고쳐 섹션 높이가 바뀌면 다시 나눈다
  useEffect(() => {
    const observer = new ResizeObserver(() => setMeasureTick((tick) => tick + 1));
    rowRefs.current.slice(0, items.length).forEach((row) => row && observer.observe(row));
    return () => observer.disconnect();
  }, [items.length, pageCount]);

  // 섹션 높이를 재서 쪽을 나눈다. 높이는 확대율과 상관없이 종이 기준 px로 잰다
  useLayoutEffect(() => {
    const paper = firstPaperRef.current;
    if (!paper) {
      return;
    }
    const scale = paper.getBoundingClientRect().width / PAPER_WIDTH || 1;
    const height = (element: Element | null) => (element ? element.getBoundingClientRect().height / scale : 0);
    const edges = [edgeHeadRef.current, edgeFootRef.current, numberRef.current].filter(Boolean);
    const fixed =
      layout.marginVerticalMm * PX_PER_MM * 2 + edges.reduce((sum, element) => sum + height(element) + PAPER_GAP, 0);
    const introHeight = height(introRef.current) + PAPER_GAP;
    const available = (pageIndex: number) => PAGE_HEIGHT - fixed - (pageIndex === 0 ? introHeight : 0);
    // 고른 섹션의 제목을 고쳐도 고르기 전 높이를 이어 쓴다
    const restHeights = restHeightRef.current;
    const last = selectedTitleRef.current;
    const selectedTitle = selectedIndex !== null ? items[selectedIndex]?.title : undefined;
    if (last && selectedTitle !== undefined && last.index === selectedIndex && last.title !== selectedTitle) {
      const kept = restHeights.get(last.title);
      if (kept !== undefined) {
        restHeights.set(selectedTitle, kept);
      }
    }
    selectedTitleRef.current = selectedIndex !== null && selectedTitle !== undefined ? { index: selectedIndex, title: selectedTitle } : null;
    const next: number[][] = [[]];
    let used = 0;
    items.forEach((item, index) => {
      const row = rowRefs.current[index];
      // 섹션 위 여백(항목 설정의 간격)도 그 섹션 자리다
      const measured = height(row) + (row ? parseFloat(getComputedStyle(row).marginTop) || 0 : 0);
      // QA 편집하려고 고른 섹션이 커져도 다른 섹션이 다음 쪽으로 밀리지 않게 고르기 전 높이로 나눈다
      if (index !== selectedIndex) {
        restHeights.set(item.title, measured);
      }
      const rowHeight = index === selectedIndex ? (restHeights.get(item.title) ?? measured) : measured;
      const current = next[next.length - 1];
      const need = (current.length > 0 ? layout.sectionGap : 0) + rowHeight;
      // 소수점 오차로 꽉 찬 쪽이 넘어가지 않게 1px 여유를 둔다
      if (current.length > 0 && used + need > available(next.length - 1) + 1) {
        next.push([index]);
        used = rowHeight;
      } else {
        current.push(index);
        used += need;
      }
    });
    if (JSON.stringify(next) !== JSON.stringify(pages)) {
      setPageState(next);
    }
  });

  // 순서를 바꾼 뒤 섹션마다 원래 자리에서 새 자리로 움직인다
  useLayoutEffect(() => {
    const flip = flipRef.current;
    flipRef.current = null;
    const paper = firstPaperRef.current;
    if (!flip || !paper) {
      return;
    }
    const scale = paper.getBoundingClientRect().width / PAPER_WIDTH || 1;
    rowRefs.current.slice(0, items.length).forEach((row, index) => {
      const before = flip.tops[flip.order[index]];
      if (!row || before === undefined) {
        return;
      }
      const dy = (before - row.getBoundingClientRect().top) / scale;
      if (Math.abs(dy) > 1) {
        row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: MOVE_MS, easing: 'ease-out' });
      }
    });
  }, [items]);

  const move = (from: number, to: number) => {
    const order = items.map((_, index) => index);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    flipRef.current = { tops: items.map((_, index) => rowRefs.current[index]?.getBoundingClientRect().top ?? 0), order };
    onMove(from, to);
  };
  // QA 섹션을 끌면 섹션 자체가 마우스를 따라오고, 다른 섹션은 놓일 자리를 비켜 준다
  const startDrag = (event: PointerEvent<HTMLSpanElement>, index: number) => {
    const paper = firstPaperRef.current;
    if (event.button !== 0 || !paper) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rects = items.map((_, position) => rowRefs.current[position]?.getBoundingClientRect());
    const scale = paper.getBoundingClientRect().width / PAPER_WIDTH || 1;
    const next = rects[index + 1] ?? rects[index - 1];
    const own = rects[index];
    const step = own ? own.height + (next ? Math.abs(next.top - own.top) - own.height : layout.sectionGap * scale) : 0;
    setDrag({
      from: index,
      to: index,
      startY: event.clientY,
      dy: 0,
      tops: rects.map((rect) => rect?.top ?? 0),
      heights: rects.map((rect) => rect?.height ?? 0),
      step,
      scale,
    });
  };
  const dragMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (!drag) {
      return;
    }
    const dy = event.clientY - drag.startY;
    const center = drag.tops[drag.from] + dy + drag.heights[drag.from] / 2;
    // 끄는 섹션 가운데보다 위에 가운데가 있는 다른 섹션 수가 새 자리
    const to = drag.tops.filter(
      (top, position) => position !== drag.from && top + drag.heights[position] / 2 < center,
    ).length;
    setDrag({ ...drag, dy, to });
  };
  const endDrag = () => {
    if (drag && drag.to !== drag.from) {
      onMove(drag.from, drag.to);
    }
    setDrag(null);
  };
  /** 끄는 동안 섹션마다 옮겨 보일 거리 (종이 px) */
  const dragOffset = (index: number) => {
    if (!drag) {
      return 0;
    }
    if (index === drag.from) {
      return drag.dy / drag.scale;
    }
    if (drag.from < drag.to && index > drag.from && index <= drag.to) {
      return -drag.step / drag.scale;
    }
    if (drag.to < drag.from && index >= drag.to && index < drag.from) {
      return drag.step / drag.scale;
    }
    return 0;
  };

  const renderRow = (item: TemplateItem, index: number) => {
    const isSelected = index === selectedIndex;
    const titleStyle = { fontSize: item.settings.titleSize * PAPER_FONT_SCALE, color: item.settings.color };
    const offset = dragOffset(index);
    const isDragging = drag?.from === index;
    return (
      <li
        key={index}
        ref={(element) => {
          rowRefs.current[index] = element;
        }}
        className={[
          styles.row,
          isSelected ? styles.selectedRow : '',
          isDragging ? styles.dragging : '',
          drag && !isDragging ? styles.makingRoom : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ marginTop: item.settings.margin / 2, transform: offset ? `translateY(${offset}px)` : undefined }}
      >
        {/* QA 69 손잡이는 섹션 테두리 바깥 왼쪽 (피그마 ReorderHandle) */}
        <span
          className={styles.handle}
          data-handle
          role="button"
          tabIndex={0}
          aria-label={`${item.title} 순서 바꾸기 (끌어서 옮기기, 위·아래 화살표)`}
          onPointerDown={(event) => startDrag(event, index)}
          onPointerMove={dragMove}
          onPointerUp={endDrag}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' && index > 0) {
              event.preventDefault();
              move(index, index - 1);
            } else if (event.key === 'ArrowDown' && index < items.length - 1) {
              event.preventDefault();
              move(index, index + 1);
            }
          }}
        >
          <Icon src={dragIcon} size={ICON_SIZE} />
        </span>
        <div
          className={[styles.card, isSelected ? styles.cardSelected : ''].filter(Boolean).join(' ')}
          onClick={() => onSelect(index)}
        >
          <div className={styles.cardHead}>
            <span className={styles.cardTitle} style={titleStyle}>
              {item.title}
            </span>
            {isSelected && (
              // QA 74, 75 연필은 빼고 휴지통만 둔다. 이름·설명은 왼쪽 항목 구성 패널에서 고친다
              <span className={styles.cardTools}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="삭제"
                  disabled={items.length <= 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(index);
                  }}
                >
                  <Icon src={deleteIcon} size={ICON_SIZE} />
                </button>
              </span>
            )}
          </div>
          <div className={styles.cardBody}>
            <SectionContent
              settings={item.settings}
              content={blankContent(item)}
              label={item.title}
              placeholder="왼쪽에서 이 항목에 무엇을 채울지 설명을 적어 주세요"
            />
          </div>
        </div>
      </li>
    );
  };

  const hasFooter = layout.footer.enabled && Boolean(layout.footer.text);

  return (
    <section className={styles.panel} aria-label="양식 미리보기">
      <div className={styles.viewport}>
        {pages.map((indices, pageIndex) => {
          const isFirst = pageIndex === 0;
          return (
            <div key={pageIndex} className={styles.pageBlock}>
              <p className={styles.paperLabel} style={{ width: `${(PAPER_WIDTH * zoom) / 100}px` }}>
                <span className={styles.paperLabelPage}>{pageIndex + 1} 페이지</span>
                <span className={styles.paperLabelName}>{name || '양식 이름'}</span>
              </p>
              <div
                ref={isFirst ? firstPaperRef : undefined}
                className={styles.paper}
                // 다크 모드에서도 양식 종이(A4)는 흰 바탕 (2026-11-24 요청). 종이 안에만 라이트 색 토큰을 다시 깐다
                data-paper
                data-theme="light"
                style={{
                  zoom: zoom / 100,
                  padding: `${layout.marginVerticalMm * PX_PER_MM}px ${layout.marginHorizontalMm * PX_PER_MM}px`,
                  // REQ-157 배경 사진은 종이 전체를 덮는다
                  ...(layout.backgroundImageUrl
                    ? { backgroundImage: `url("${layout.backgroundImageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : {}),
                }}
              >
                {layout.header.enabled && layout.header.text && (
                  <p ref={isFirst ? edgeHeadRef : undefined} className={styles.edge}>
                    {layout.header.text}
                  </p>
                )}
                {isFirst && (
                  <div ref={introRef} className={styles.intro}>
                    <h2 className={styles.docTitle} style={{ textAlign: layout.align.toLowerCase() as 'left' | 'center' | 'right' }}>
                      {name || '양식 이름'}
                    </h2>
                    {layout.showMeetingInfo && (
                      <section className={styles.meetingInfo} aria-label="회의 기본 정보">
                        <h3 className={styles.meetingInfoTitle}>회의 기본 정보</h3>
                        <dl className={styles.meetingInfoList}>
                          {/* QA 77 예시 값은 비우고 이름만 둔다 */}
                          {SAMPLE_MEETING_INFO.map(([label]) => (
                            <div key={label} className={styles.meetingInfoRow}>
                              <dt>{label}</dt>
                              <dd />
                            </div>
                          ))}
                        </dl>
                      </section>
                    )}
                  </div>
                )}
                <ol className={styles.sections} style={{ gap: layout.sectionGap }}>
                  {indices.map((index) => renderRow(items[index], index))}
                </ol>
                {hasFooter && (
                  <p ref={isFirst ? edgeFootRef : undefined} className={`${styles.edge} ${styles.footer}`}>
                    {layout.footer.text}
                  </p>
                )}
                {layout.pageNumber && (
                  <p
                    ref={isFirst ? numberRef : undefined}
                    className={[styles.pageNumber, hasFooter ? '' : styles.footer].filter(Boolean).join(' ')}
                  >
                    - {pageIndex + 1} -
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 디자인 CanvasArea 아래 바: ZoomControl만 왼쪽에 둔다 (QA 72 섹션 버튼, 쪽 이동은 뺐다) */}
      <div className={styles.bottomBar}>
        <span className={styles.zoom}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="축소"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => value - ZOOM_STEP)}
          >
            <Icon src={zoomOutIcon} size={ICON_SIZE} />
          </button>
          <span className={styles.zoomLabel}>{zoom}%</span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="확대"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => value + ZOOM_STEP)}
          >
            <Icon src={zoomInIcon} size={ICON_SIZE} />
          </button>
        </span>
      </div>
    </section>
  );
}
