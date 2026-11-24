import SectionContent from '../../components/SectionContent';
import type { TemplateItem, TemplateLayout } from '../../types/template';
import { SAMPLE_MEETING_INFO, sampleContent } from '../../utils/templateSample';
import { PAPER_FONT_SCALE, PX_PER_MM } from '../../utils/templateSettings';
import styles from './TemplatePaper.module.css';

// 양식 편집 미리보기(TemplatePreview)와 같은 종이 폭. 보여 줄 칸 폭에 맞춰 zoom으로 줄인다
const PAPER_WIDTH = 456;

interface TemplatePaperProps {
  name: string;
  items: TemplateItem[];
  layout: TemplateLayout;
  /** 종이를 보여 줄 칸 폭 (px) */
  width: number;
}

/**
 * 양식을 실제 회의록 종이처럼 예시 내용으로 채워 보여 준다 (보기만). 회의 대기 양식 상세 보기 (SCRUM-364, 디자인 요청).
 * 양식 편집 미리보기와 같은 설정(여백, 섹션 간격, 정렬, 글자 크기·색, 머리말·꼬리말, 배경)을 따른다
 */
export default function TemplatePaper({ name, items, layout, width }: TemplatePaperProps) {
  const align = layout.align.toLowerCase() as 'left' | 'center' | 'right';
  return (
    <div
      className={styles.paper}
      // 다크 모드에서 양식 글자색·표 머리 색을 토큰 색으로 바꾸는 index.css 규칙을 같이 받는다
      data-paper
      aria-label={`${name} 미리보기`}
      style={{
        zoom: width / PAPER_WIDTH,
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
            <SectionContent settings={item.settings} content={sampleContent(item)} label={item.title} />
          </li>
        ))}
      </ol>
      {layout.footer.enabled && layout.footer.text && <p className={`${styles.edge} ${styles.footer}`}>{layout.footer.text}</p>}
      {layout.pageNumber && <p className={styles.pageNumber}>- 1 -</p>}
    </div>
  );
}
