import type { ItemSettings } from '../types/template';
import { CELL_SEPARATOR, PAPER_FONT_SCALE } from '../utils/templateSettings';
import RichTextField from './RichTextField';
import styles from './SectionContent.module.css';

const MAX_CONTENT_LENGTH = 20000;
/** 할 일 줄 끝의 "(담당자, 기한)"을 떼어 오른쪽에 따로 보인다 */
const CHECKLIST_META = /^(.*?)\s*(\([^()]*\))\s*$/;
const LIST_MARKER = /^\s*[-*•]\s+/;

interface SectionContentProps {
  settings: ItemSettings;
  content: string;
  /** 칸 이름 (화면 읽기 프로그램용) */
  label: string;
  editable?: boolean;
  placeholder?: string;
  /** REQ-194 줄글 칸에 서식을 쓸지 (회의록 응답의 richText). 끄면 예전처럼 서식 없는 입력 칸 */
  richText?: boolean;
  /** 서식을 담은 HTML. 없으면 null */
  richContent?: string | null;
  /** 서식 칸이면 richContent도 함께 준다. 아니면 null (예전 서식은 지운다) */
  onChange?: (content: string, richContent: string | null) => void;
}

/** 서식 없이 저장된 글을 서식 칸에 넣을 HTML로 바꾼다 */
function textToHtml(text: string) {
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return escaped.replaceAll('\n', '<br>');
}

/** 서식 없이 저장된 목록을 서식 칸에 넣을 HTML 목록으로 바꾼다 (한 줄이 한 항목, AI 초안의 "- "는 뗀다) */
function listToHtml(text: string) {
  const items = text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => textToHtml(line.replace(LIST_MARKER, '')));
  return `<ul>${(items.length ? items : ['<br>']).map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

/** 줄 = 행, 탭 = 열. 양식의 행·열 수보다 적으면 빈 칸으로 채운다 */
function toGrid(content: string, settings: ItemSettings) {
  const lines = content ? content.split('\n').map((line) => line.split(CELL_SEPARATOR)) : [];
  const rows = Math.max(settings.table.rows, lines.length);
  const cols = Math.max(settings.table.cols, ...lines.map((line) => line.length), 1);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => lines[r]?.[c] ?? ''));
}

/**
 * 양식 항목 설정(기록 방식·글자 크기·색·표)에 맞춰 칸 내용을 그린다. 회의록 작성 화면과 양식 편집 미리보기가 함께 쓴다.
 * 목록·체크리스트는 한 줄이 한 항목이고, 표는 줄 = 행, 탭 = 열로 저장한다 (서버 PDF와 같은 형식)
 */
export default function SectionContent({
  settings,
  content,
  label,
  editable = false,
  placeholder,
  richText = false,
  richContent = null,
  onChange,
}: SectionContentProps) {
  const style = { fontSize: settings.bodySize * PAPER_FONT_SCALE, color: settings.color };

  if (settings.recordType === 'TABLE') {
    const grid = toGrid(content, settings);
    const change = (row: number, col: number, value: string) => {
      const next = grid.map((cells) => [...cells]);
      next[row][col] = value.replaceAll(CELL_SEPARATOR, ' ').replaceAll('\n', ' ');
      onChange?.(next.map((cells) => cells.join(CELL_SEPARATOR)).join('\n'), null);
    };
    return (
      <table
        className={[styles.table, styles[`border${settings.table.border}`], settings.table.autoWidth ? '' : styles.fixed]
          .filter(Boolean)
          .join(' ')}
        style={style}
        aria-label={label}
      >
        <tbody>
          {grid.map((cells, row) => (
            <tr key={row} style={row === 0 ? { background: settings.table.headerColor } : undefined}>
              {cells.map((cell, col) => (
                <td key={col} style={{ textAlign: settings.table.align.toLowerCase() as 'left' | 'center' | 'right' }}>
                  {editable ? (
                    <input
                      className={styles.cellInput}
                      aria-label={`${label} ${row + 1}행 ${col + 1}열`}
                      value={cell}
                      onChange={(event) => change(row, col, event.target.value)}
                    />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // REQ-194 서식은 HTML로 저장한다. 줄글에 더해 목록 칸도 서식을 쓴다 (QA 58). 체크리스트, 표는 칸 모양 때문에 서식 없이 둔다
  const isRich = richText && (settings.recordType === 'FREE' || settings.recordType === 'LIST');
  if (editable && isRich) {
    return (
      <RichTextField
        html={richContent ?? (settings.recordType === 'LIST' ? listToHtml(content) : textToHtml(content))}
        label={label}
        placeholder={placeholder}
        style={style}
        onChange={(text, html) => onChange?.(text, html)}
      />
    );
  }

  if (editable) {
    return (
      <textarea
        className={styles.textarea}
        style={style}
        aria-label={`${label} 내용`}
        placeholder={settings.recordType === 'FREE' ? placeholder : '한 줄에 하나씩 입력해 주세요'}
        maxLength={MAX_CONTENT_LENGTH}
        value={content}
        onChange={(event) => onChange?.(event.target.value, null)}
      />
    );
  }

  const lines = content.split('\n').filter((line) => line.trim());
  // AI 초안은 줄 앞에 "- "를 붙이므로 목록, 체크리스트에서는 떼고 보인다
  const items = lines.map((line) => line.replace(LIST_MARKER, ''));
  if (lines.length === 0) {
    return (
      <p className={styles.empty} style={style}>
        {placeholder ?? '내용이 없어요.'}
      </p>
    );
  }
  if (isRich && richContent) {
    // 서버가 허용한 태그만 남긴 HTML이다 (minutes-service RichText)
    return <div className={`${styles.text} ${styles.rich}`} style={style} dangerouslySetInnerHTML={{ __html: richContent }} />;
  }
  if (settings.recordType === 'LIST') {
    return (
      // data-list: 아주 작게 줄여 보여 주는 곳(회의 대기 양식 미리보기)이 글머리 점을 직접 그릴 때 찾는 표시
      <ul className={styles.list} style={style} data-list>
        {items.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    );
  }
  if (settings.recordType === 'CHECKLIST') {
    return (
      <ul className={styles.checklist} style={style}>
        {items.map((line, index) => {
          const [, task, meta] = line.match(CHECKLIST_META) ?? [line, line, ''];
          return (
            <li key={index}>
              <span className={styles.box} aria-hidden="true" />
              <span className={styles.task}>{task}</span>
              {meta && <span className={styles.meta}>{meta}</span>}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <p className={styles.text} style={style}>
      {content}
    </p>
  );
}
