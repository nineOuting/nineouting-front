import type { CSSProperties } from 'react';
import styles from './Icon.module.css';

interface IconProps {
  /** src/assets/icons의 SVG. 모양만 쓰고 색은 글자색(currentColor)을 따른다 */
  src: string;
  size: number;
  className?: string;
}

/**
 * 디자인 아이콘. 피그마에서 받은 SVG는 상태마다 색만 다른 파일로 나와서,
 * 모양(mask)만 쓰고 색은 감싼 요소의 글자색으로 칠한다 (고른 메뉴는 보라, 아닌 메뉴는 회색 등)
 */
export default function Icon({ src, size, className }: IconProps) {
  const style = { '--icon-src': `url("${src}")`, width: size, height: size } as CSSProperties;
  return <span aria-hidden="true" className={[styles.icon, className].filter(Boolean).join(' ')} style={style} />;
}
