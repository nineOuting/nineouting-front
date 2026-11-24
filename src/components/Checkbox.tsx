import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import checkboxOffIcon from '../assets/icons/checkbox-off.svg';
import checkboxOnIcon from '../assets/icons/checkbox-on.svg';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children: ReactNode;
  tone?: 'default' | 'muted';
  className?: string;
  /** 상자 색 (홈 프로젝트 필터는 폴더 색). 없으면 기본 파랑 */
  boxColor?: string;
  /**
   * icon: 디자인 시스템 CheckboxOnIcon / CheckboxOffIcon 모양 (16px 자리에 12px 상자, 얇은 테두리, 뚫린 체크).
   * 지금은 아카이브 필터만 쓴다. 기본(box)은 예전 모양 (SCRUM-366)
   */
  look?: 'box' | 'icon';
}

export default function Checkbox({ children, tone = 'default', className, boxColor, look = 'box', ...inputProps }: CheckboxProps) {
  const style = {
    ...(boxColor ? { '--checkbox-color': boxColor } : {}),
    ...(look === 'icon' ? { '--checkbox-on': `url("${checkboxOnIcon}")`, '--checkbox-off': `url("${checkboxOffIcon}")` } : {}),
  } as CSSProperties;
  return (
    <label
      className={[styles.checkbox, styles[tone], boxColor ? styles.colored : '', look === 'icon' ? styles.icon : '', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <input type="checkbox" className={styles.input} {...inputProps} />
      <span className={styles.box} aria-hidden="true" />
      {children}
    </label>
  );
}
