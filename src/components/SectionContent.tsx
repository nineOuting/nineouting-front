import type { ItemSettings } from '../types/template';
import { CELL_SEPARATOR, PAPER_FONT_SCALE } from '../utils/templateSettings';
import styles from './SectionContent.module.css';

const MAX_CONTENT_LENGTH = 20000;

interface SectionContentProps {
  settings: ItemSettings;
  content: string;
  /** 칸 이름 (화면 읽기 프로그램용) */
  label: string;
  editable?: boolean;
  placeholder?: string;
  onChange?: (content: string) => void;
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
export default function SectionContent({ settings, content, label, editable = false, placeholder, onChange }: SectionContentProps) {
  const style = { fontSize: settings.bodySize * PAPER_FONT_SCALE, color: settings.color };

  if (settings.recordType === 'TABLE') {
    const grid = toGrid(content, settings);
    const change = (row: number, col: number, value: string) => {
      const next = grid.map((cells) => [...cells]);
      next[row][col] = value.replaceAll(CELL_SEPARATOR, ' ').replaceAll('\n', ' ');
      onChange?.(next.map((cells) => cells.join(CELL_SEPARATOR)).join('\n'));
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

  if (editable) {
    return (
      <textarea
        className={styles.textarea}
        style={style}
        aria-label={`${label} 내용`}
        placeholder={settings.recordType === 'FREE' ? placeholder : '한 줄에 하나씩 입력해 주세요'}
        maxLength={MAX_CONTENT_LENGTH}
        value={content}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  }

  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) {
    return (
      <p className={styles.empty} style={style}>
        {placeholder ?? '내용이 없어요.'}
      </p>
    );
  }
  if (settings.recordType === 'LIST') {
    return (
      <ul className={styles.list} style={style}>
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    );
  }
  if (settings.recordType === 'CHECKLIST') {
    return (
      <ul className={styles.checklist} style={style}>
        {lines.map((line, index) => (
          <li key={index}>
            <span className={styles.box} aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className={styles.text} style={style}>
      {content}
    </p>
  );
}
