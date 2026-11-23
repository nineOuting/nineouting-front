import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children: ReactNode;
  tone?: 'default' | 'muted';
  className?: string;
  /** 상자 색 (홈 프로젝트 필터는 폴더 색). 없으면 기본 파랑 */
  boxColor?: string;
}

export default function Checkbox({ children, tone = 'default', className, boxColor, ...inputProps }: CheckboxProps) {
  const style = boxColor ? ({ '--checkbox-color': boxColor } as CSSProperties) : undefined;
  return (
    <label className={[styles.checkbox, styles[tone], boxColor ? styles.colored : '', className].filter(Boolean).join(' ')} style={style}>
      <input type="checkbox" className={styles.input} {...inputProps} />
      <span className={styles.box} aria-hidden="true" />
      {children}
    </label>
  );
}
