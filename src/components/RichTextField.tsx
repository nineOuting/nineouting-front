import { useEffect, useRef, type CSSProperties } from 'react';
import styles from './SectionContent.module.css';

interface RichTextFieldProps {
  /** 서식을 담은 HTML. 서버가 허용한 태그(굵게, 기울임, 밑줄, 목록, 정렬)만 남긴 값이다 */
  html: string;
  /** 칸 이름 (화면 읽기 프로그램용) */
  label: string;
  placeholder?: string;
  style: CSSProperties;
  /** content: 서식 없는 글 (검색, AI가 쓴다), richContent: 서식을 담은 HTML */
  onChange: (content: string, richContent: string) => void;
}

/**
 * REQ-194 서식을 넣을 수 있는 회의록 칸. 회의록 작성 화면의 서식 막대가 고른 글자에 굵게, 기울임, 밑줄, 목록, 정렬을 넣는다.
 * 입력하는 동안에는 브라우저가 그린 내용을 그대로 두고, 되돌리기나 AI 초안처럼 밖에서 내용이 바뀔 때만 다시 넣는다 (커서가 튀지 않게)
 */
export default function RichTextField({ html, label, placeholder, style, onChange }: RichTextFieldProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className={`${styles.textarea} ${styles.rich}`}
      style={style}
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-label={`${label} 내용`}
      data-placeholder={placeholder}
      onInput={(event) => {
        const field = event.currentTarget;
        onChange(field.innerText.replace(/\n$/, ''), field.innerHTML);
      }}
      onPaste={(event) => {
        // 다른 곳에서 복사한 글의 글꼴, 색은 가져오지 않는다
        event.preventDefault();
        document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
      }}
    />
  );
}
