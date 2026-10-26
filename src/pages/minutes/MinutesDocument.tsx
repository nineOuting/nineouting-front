import { useEffect, useRef, useState } from 'react';
import type { MinutesDetail, MinutesSection, MinutesTemplateInfo } from '../../api/minutes';
import DropdownMenu from '../../components/DropdownMenu';
import Placeholder from '../../components/Placeholder';
import styles from './MinutesDocument.module.css';

const NAV_ICON_SIZE = 18;
const TOOL_ICON_SIZE = 16;
// A4 한 장 (디자인 23:626: 456×675)
const PAGE_HEIGHT = 675;
const ZOOMS = [50, 75, 100, 125, 150];

interface MinutesDocumentProps {
  minutes: MinutesDetail;
  sections: MinutesSection[];
  meta: string[];
  canEdit: boolean;
  canChangeTemplate: boolean;
  templates: MinutesTemplateInfo[];
  onChangeSection: (index: number, content: string) => void;
  onChangeTemplate: (templateId: number) => void;
}

/** REQ-132 선택한 양식에 맞춘 회의록을 문서(A4) 모양으로 편집한다. 쪽 이동, 확대·축소, 양식 변경 (REQ-140) */
export default function MinutesDocument({
  minutes,
  sections,
  meta,
  canEdit,
  canChangeTemplate,
  templates,
  onChangeSection,
  onChangeTemplate,
}: MinutesDocumentProps) {
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLButtonElement>(null);
  const pageHeight = (PAGE_HEIGHT * zoom) / 100;

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
    <section className={styles.panel} aria-label="회의록 문서">
      <div className={styles.pager}>
        <button type="button" className={styles.iconButton} aria-label="이전 쪽" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          <Placeholder size={NAV_ICON_SIZE} />
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
          <Placeholder size={NAV_ICON_SIZE} />
        </button>
      </div>
      <div className={styles.toolbar} role="toolbar" aria-label="편집 도구">
        <label className={styles.tool}>
          <select
            className={styles.zoom}
            aria-label="확대·축소"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {ZOOMS.map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
          <Placeholder size={TOOL_ICON_SIZE} />
        </label>
        <span className={styles.anchor}>
          <button
            ref={templateRef}
            type="button"
            className={styles.tool}
            disabled={!canChangeTemplate}
            title={canChangeTemplate ? undefined : '작성 중인 회의록의 작성자만 양식을 바꿀 수 있어요'}
            aria-haspopup="listbox"
            aria-expanded={isTemplateOpen}
            onClick={() => setIsTemplateOpen((open) => !open)}
          >
            회의록 양식 변경
            <Placeholder size={TOOL_ICON_SIZE} />
          </button>
          {isTemplateOpen && (
            <DropdownMenu
              label="회의록 양식"
              emptyText="양식이 없어요"
              anchorRef={templateRef}
              className={styles.templateMenu}
              items={templates.map((template) => ({
                id: String(template.templateId),
                label: template.name,
                description: template.items.join(' · '),
                isSelected: template.templateId === minutes.templateId,
              }))}
              onSelect={(id) => {
                setIsTemplateOpen(false);
                onChangeTemplate(Number(id));
              }}
              onClose={() => setIsTemplateOpen(false)}
            />
          )}
        </span>
      </div>
      <div
        ref={viewportRef}
        className={styles.viewport}
        onScroll={(event) => setPage(Math.min(pageCount, Math.floor(event.currentTarget.scrollTop / pageHeight + 0.5) + 1))}
      >
        <div ref={paperRef} className={styles.paper} style={{ zoom: zoom / 100 }}>
          <h2 className={styles.docTitle}>{minutes.title}</h2>
          <ul className={styles.meta}>
            {meta.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {sections.map((section, index) => (
            <div key={section.sectionId ?? `new-${index}`} className={styles.section}>
              <h3 className={styles.sectionTitle}>{section.title}</h3>
              {canEdit ? (
                <textarea
                  className={styles.content}
                  aria-label={`${section.title} 내용`}
                  placeholder="내용을 입력해 주세요"
                  maxLength={20000}
                  value={section.content}
                  onChange={(event) => onChangeSection(index, event.target.value)}
                />
              ) : (
                <p className={styles.contentText}>{section.content || '내용이 없어요.'}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
