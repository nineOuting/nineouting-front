import type { ReactNode } from 'react';
import styles from './SettingsLayout.module.css';

interface SettingsLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * 설정 창(SettingsModal) 오른쪽 내용의 틀: 제목, 설명, 내용.
 * REQ-145 마이페이지(프로필, 요금제, 화면 설정, 도움말, 삭제 목록)와 같은 곳이고 창 제목은 "설정"이다
 */
export default function SettingsLayout({ title, description, children }: SettingsLayoutProps) {
  return (
    <section className={styles.content} aria-labelledby="settings-section-title">
      <div className={styles.sectionTitle}>
        <h2 id="settings-section-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
      </div>
      {children}
    </section>
  );
}
