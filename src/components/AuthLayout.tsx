import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
  className?: string;
}

export default function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link to="/login" className={styles.logo}>
          sync
        </Link>
      </header>
      <main className={[styles.main, className].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
