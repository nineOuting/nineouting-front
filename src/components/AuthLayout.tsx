import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/icons/logo.svg';
import styles from './AuthLayout.module.css';

const LOGO_WIDTH = 84;
const LOGO_HEIGHT = 16;

interface AuthLayoutProps {
  children: ReactNode;
  className?: string;
}

/** 로그인 전 화면 틀 (디자인 LoginPage: 위 64px 로고, 가운데 카드) */
export default function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        {/* 로그인하지 않았으면 랜딩, 로그인했으면 홈 (/ 라우트가 나눈다) */}
        <Link to="/" aria-label="nep!nep! 첫 화면으로">
          <img src={logo} alt="nep!nep!" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nepnep-logo" />
        </Link>
      </header>
      <main className={[styles.main, className].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
