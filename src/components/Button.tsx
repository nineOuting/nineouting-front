import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 디자인 Button: primary(보라), secondary(옅은 파랑), neutral(테두리), danger(빨강), text(글자만) */
  variant?: 'primary' | 'secondary' | 'neutral' | 'danger' | 'text';
  /** lg 48px(로그인 등 한 줄을 다 쓰는 버튼), md 40px(창, 화면 안 버튼) */
  size?: 'lg' | 'md';
  /** 한 줄을 다 채운다 (lg는 기본으로 채운다) */
  block?: boolean;
}

export default function Button({ variant = 'primary', size = 'lg', block, type = 'button', className, ...props }: ButtonProps) {
  const isBlock = block ?? (size === 'lg' && variant !== 'text');
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], styles[size], isBlock ? styles.block : '', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
