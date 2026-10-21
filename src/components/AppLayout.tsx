import type { ReactNode } from 'react';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

/** 로그인 후 화면 틀. 왼쪽 메뉴(REQ-001)·상단 바는 디자인이 나오기 전까지 자리만 잡는다 */
export default function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.logo}>sync</span>
      </header>
      <aside className={styles.sidebar} aria-label="메뉴" />
      <main className={[styles.main, className].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
