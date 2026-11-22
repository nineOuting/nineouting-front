import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MinutesDetail, MinutesSection } from '../../api/minutes';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import zoomInIcon from '../../assets/icons/zoom-in.svg';
import zoomOutIcon from '../../assets/icons/zoom-out.svg';
import Icon from '../../components/Icon';
import SectionContent from '../../components/SectionContent';
import type { MinutesTemplate } from '../../types/template';
import { DEFAULT_LAYOUT, PAPER_FONT_SCALE, PX_PER_MM, withItemDefaults } from '../../utils/templateSettings';
import styles from './MinutesDocument.module.css';

const ICON_SIZE = 16;
// 디자인 DocumentPage 560×792 (A4 비율)
const PAGE_HEIGHT = 792;
const MIN_ZOOM = 50;
const MAX_ZOOM = 150;
const ZOOM_STEP = 10;

/** 회의 기본 정보 한 줄 (디자인 DocInfoList: 일시, 장소, 참석자) */
export interface DocInfo {
  label: string;
  value: string;
}

interface MinutesDocumentProps {
  minutes: MinutesDetail;
  sections: MinutesSection[];
  info: DocInfo[];
  canEdit: boolean;
  templates: MinutesTemplate[];
  /** 문서 위에 띄울 안내 (AI 초안 만드는 중 등) */
  notice?: ReactNode;
  onChangeSection: (index: number, content: string, richContent: string | null) => void;
}

/** REQ-132 선택한 양식에 맞춘 회의록을 문서(A4) 모양으로 편집한다. 쪽 이동, 확대·축소 (디자인 CanvasArea) */
export default function MinutesDocument({
  minutes,
  sections,
  info,
  canEdit,
  templates,
  notice,
  onChangeSection,
}: MinutesDocumentProps) {
  const [zoom, setZoom] = useState(100);
  // 확대 비율은 숫자로도 입력한다. 입력하는 동안의 글자는 따로 두고, Enter나 칸을 벗어나면 범위 안으로 맞춰 반영한다
  const [zoomDraft, setZoomDraft] = useState<string | null>(null);
  const commitZoom = () => {
    const value = Number.parseInt(zoomDraft ?? '', 10);
    if (Number.isFinite(value)) {
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)));
    }
    setZoomDraft(null);
  };
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const pageHeight = (PAGE_HEIGHT * zoom) / 100;
  // 양식의 레이아웃·항목 설정을 문서에 그대로 쓴다 (양식이 지워졌으면 기본값)
  // 내 양식 목록에 없는 양식(다른 사람의 개인 양식)이면 회의록 응답에 함께 온 양식 설정을 쓴다
  const template = templates.find(({ templateId }) => templateId === minutes.templateId) ?? minutes.template ?? undefined;
  const layout = template?.layout ?? DEFAULT_LAYOUT;
  const settingsOf = (title: string) => withItemDefaults(template?.items.find((item) => item.title === title)?.settings);

  // 내용이 늘거나 확대하면 쪽 수가 바뀐다
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

  return (
    <section className={styles.canvas} aria-label="회의록 문서">
      <div
        ref={viewportRef}
        className={styles.viewport}
        onScroll={(event) => setPage(Math.min(pageCount, Math.floor(event.currentTarget.scrollTop / pageHeight + 0.5) + 1))}
      >
        <div className={styles.pageBlock}>
          {/* 디자인 PageLabel: 1 페이지 회의명 */}
          <p className={styles.pageLabel}>
            <span className={styles.pageNumber}>{page} 페이지</span>
            <span className={styles.pageTitle}>{minutes.title}</span>
          </p>
          {/* 디자인 Banner: 쪽 라벨과 문서 사이, 문서 폭 (디자인 체크 2026-11-19) */}
          {notice}
          <div
            ref={paperRef}
            className={styles.paper}
            // 피그마 다크 모드처럼 종이도 테마를 따른다. 양식에서 고른 글자색, 표 머리 색은 다크에서 index.css가 토큰 색으로 바꾼다
            data-paper
            style={{
              zoom: zoom / 100,
              gap: layout.sectionGap,
              padding: `${layout.marginVerticalMm * PX_PER_MM}px ${layout.marginHorizontalMm * PX_PER_MM}px`,
            }}
          >
            {layout.header.enabled && layout.header.text && <p className={styles.edge}>{layout.header.text}</p>}
            <h2 className={styles.docTitle} style={{ textAlign: layout.align.toLowerCase() as 'left' | 'center' | 'right' }}>
              {minutes.title}
            </h2>
            {layout.showMeetingInfo && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>회의 기본 정보</h3>
                <dl className={styles.infoList}>
                  {info.map(({ label, value }) => (
                    <div key={label} className={styles.infoRow}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {sections.map((section, index) => {
              const settings = settingsOf(section.title);
              return (
                <div
                  key={section.sectionId ?? `new-${index}`}
                  className={styles.section}
                  style={{ marginTop: settings.margin / 2 }}
                >
                  <h3
                    className={styles.sectionTitle}
                    style={{ fontSize: settings.titleSize * PAPER_FONT_SCALE, color: settings.color }}
                  >
                    {section.title}
                  </h3>
                  <SectionContent
                    settings={settings}
                    content={section.content}
                    label={section.title}
                    editable={canEdit}
                    placeholder={canEdit ? '내용을 입력해 주세요' : '내용이 없어요.'}
                    richText={minutes.richText}
                    richContent={section.richContent}
                    onChange={(content, richContent) => onChangeSection(index, content, richContent)}
                  />
                </div>
              );
            })}
            {layout.footer.enabled && layout.footer.text && (
              <p className={`${styles.edge} ${styles.footer}`}>{layout.footer.text}</p>
            )}
          </div>
        </div>
      </div>

      {/* 디자인 CanvasBottomBar: 쪽 이동(왼쪽), ZoomControl(오른쪽) */}
      <div className={styles.bottomBar}>
        <span className={styles.pager}>
          <button type="button" className={styles.iconButton} aria-label="이전 쪽" disabled={page <= 1} onClick={() => goTo(page - 1)}>
            <Icon src={chevronLeftIcon} size={ICON_SIZE} />
          </button>
          <span className={styles.barLabel}>
            {page} / {pageCount}
          </span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="다음 쪽"
            disabled={page >= pageCount}
            onClick={() => goTo(page + 1)}
          >
            <Icon src={chevronRightIcon} size={ICON_SIZE} />
          </button>
        </span>
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
          <input
            className={styles.zoomValue}
            aria-label="확대 비율 (%)"
            inputMode="numeric"
            value={zoomDraft ?? `${zoom}%`}
            onFocus={(event) => {
              const input = event.currentTarget;
              setZoomDraft(String(zoom));
              // 값이 "100%"에서 "100"으로 바뀐 뒤에 전부 골라 둔다 (바로 덮어 쓰게)
              window.requestAnimationFrame(() => input.select());
            }}
            onChange={(event) => setZoomDraft(event.target.value.replace(/[^0-9]/g, ''))}
            onBlur={commitZoom}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
          />
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
