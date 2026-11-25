import TemplateSectionBlank from '../../components/TemplateSectionBlank';
import type { TemplateItem, TemplateLayout } from '../../types/template';
import { SAMPLE_MEETING_INFO } from '../../utils/templateSample';
import { A4_HEIGHT_PX, A4_WIDTH_PX, PAPER_FONT_SCALE, PX_PER_MM } from '../../utils/templateSettings';
import styles from './TemplatePaper.module.css';

// 양식 편집 미리보기(TemplatePreview)와 같은 실제 A4 크기 종이. 한 쪽 높이도 같다
export const PAPER_WIDTH = A4_WIDTH_PX;
export const PAPER_PAGE_HEIGHT = A4_HEIGHT_PX;

interface TemplatePaperProps {
  name: string;
  items: TemplateItem[];
  layout: TemplateLayout;
  /** 줄이는 비율 (1이면 실제 종이 크기) */
  scale: number;
  /** 종이를 이 쪽 수만큼은 채운다. 쪽 넘기기에서 마지막 쪽의 남는 부분도 흰 종이로 보이게 한다 */
  minPages?: number;
  /** 카드처럼 아주 작게 줄일 때. 글머리 점을 글자 줄 안에 넣는다 */
  tiny?: boolean;
}

/**
 * 양식을 실제 회의록 종이처럼 예시 내용으로 채워 보여 준다 (보기만). 회의 대기 양식 카드·상세 보기 (SCRUM-364, 디자인 요청).
 * 양식 편집 미리보기와 같은 설정(여백, 섹션 간격, 정렬, 글자 크기·색, 머리말·꼬리말, 배경)을 따른다
 */
export default function TemplatePaper({ name, items, layout, scale, minPages = 1, tiny = false }: TemplatePaperProps) {
  const align = layout.align.toLowerCase() as 'left' | 'center' | 'right';
  return (
    <div
      className={[styles.paper, tiny ? styles.tiny : ''].filter(Boolean).join(' ')}
      // 다크 모드에서도 양식 종이는 흰 바탕 (2026-11-24 요청, 회의록 종이와 같게)
      data-paper
      data-theme="light"
      aria-label={`${name} 미리보기`}
      style={{
        zoom: scale,
        minHeight: PAPER_PAGE_HEIGHT * minPages,
        padding: `${layout.marginVerticalMm * PX_PER_MM}px ${layout.marginHorizontalMm * PX_PER_MM}px`,
        // REQ-157 배경 사진은 종이 전체를 덮는다
        ...(layout.backgroundImageUrl
          ? { backgroundImage: `url("${layout.backgroundImageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : {}),
      }}
    >
      {layout.header.enabled && layout.header.text && <p className={styles.edge}>{layout.header.text}</p>}
      <h3 className={styles.docTitle} style={{ textAlign: align }}>
        {name}
      </h3>
      {layout.showMeetingInfo && (
        <section className={styles.meetingInfo} aria-label="회의 기본 정보">
          <h4 className={styles.meetingInfoTitle}>회의 기본 정보</h4>
          <dl className={styles.meetingInfoList}>
            {SAMPLE_MEETING_INFO.map(([label, value]) => (
              <div key={label} className={styles.meetingInfoRow}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <ol className={styles.sections} style={{ gap: layout.sectionGap }}>
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className={styles.section} style={{ marginTop: item.settings.margin / 2 }}>
            <h4
              className={styles.sectionTitle}
              style={{ fontSize: item.settings.titleSize * PAPER_FONT_SCALE, color: item.settings.color }}
            >
              {item.title}
            </h4>
            <TemplateSectionBlank item={item} />
          </li>
        ))}
      </ol>
      {layout.footer.enabled && layout.footer.text && <p className={`${styles.edge} ${styles.footer}`}>{layout.footer.text}</p>}
      {layout.pageNumber && <p className={styles.pageNumber}>- 1 -</p>}
    </div>
  );
}
