import { useEffect, useState, type ButtonHTMLAttributes } from 'react';
import Spinner from './Spinner';
import styles from './Button.module.css';

// REQ-178 1초 넘게 걸리면 로딩 아이콘을 보여 준다 (짧은 작업에 아이콘이 깜빡이지 않게)
const LOADING_DELAY_MS = 1000;
const SPINNER_SIZE = { lg: 20, md: 16 } as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 디자인 Button: primary(보라), secondary(옅은 파랑), neutral(테두리), danger(빨강), text(글자만) */
  variant?: 'primary' | 'secondary' | 'neutral' | 'danger' | 'text';
  /** lg 48px(로그인 등 한 줄을 다 쓰는 버튼), md 40px(창, 화면 안 버튼) */
  size?: 'lg' | 'md';
  /** 한 줄을 다 채운다 (lg는 기본으로 채운다) */
  block?: boolean;
  /** REQ-178 일을 하는 중: 바로 다시 누를 수 없고, 1초가 넘으면 로딩 아이콘이 붙는다 */
  isLoading?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'lg',
  block,
  type = 'button',
  className,
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isBlock = block ?? (size === 'lg' && variant !== 'text');
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      return undefined;
    }
    const timerId = window.setTimeout(() => setIsSlow(true), LOADING_DELAY_MS);
    return () => {
      window.clearTimeout(timerId);
      setIsSlow(false);
    };
  }, [isLoading]);

  return (
    <button
      type={type}
      className={[styles.button, styles[variant], styles[size], isBlock ? styles.block : '', className]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && isSlow && <Spinner size={SPINNER_SIZE[size]} />}
      {children}
    </button>
  );
}
