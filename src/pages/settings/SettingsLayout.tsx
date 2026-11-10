import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { listMyWorkspaces } from '../../api/workspace';
import helpIcon from '../../assets/icons/nav-help.svg';
import planIcon from '../../assets/icons/template-sm.svg';
import profileIcon from '../../assets/icons/nav-profile.svg';
import settingsIcon from '../../assets/icons/nav-settings.svg';
import trashIcon from '../../assets/icons/nav-trash.svg';
import AppLayout from '../../components/AppLayout';
import Icon from '../../components/Icon';
import styles from './SettingsLayout.module.css';

const ICON_SIZE = 20;

interface SettingsLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

const navClass = ({ isActive }: { isActive: boolean }) => [styles.navItem, isActive ? styles.selected : ''].join(' ');

/**
 * 설정 화면 틀 (디자인 SettingsPage: 왼쪽 메뉴 220px + 내용).
 * REQ-145 마이페이지(프로필, 요금제, 화면 설정, 도움말, 삭제 목록)와 같은 화면이고 제목은 "설정"이다.
 * 삭제 목록은 첫 워크스페이스의 쓰레기통으로 간다 (REQ-143, 화면 안에서 워크스페이스를 바꾼다)
 */
export default function SettingsLayout({ title, description, children }: SettingsLayoutProps) {
  const [trashWorkspaceId, setTrashWorkspaceId] = useState<number>();

  useEffect(() => {
    let isCurrent = true;
    listMyWorkspaces()
      .then((items) => {
        if (isCurrent && items[0]) {
          setTrashWorkspaceId(items[0].workspaceId);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <AppLayout className={styles.page}>
      <h1 className={styles.pageTitle}>설정</h1>
      <div className={styles.columns}>
        <nav className={styles.nav} aria-label="설정 메뉴">
          <NavLink to="/profile" className={navClass}>
            <Icon src={profileIcon} size={ICON_SIZE} className={styles.icon} />
            프로필
          </NavLink>
          <NavLink to="/plan" className={navClass}>
            <Icon src={planIcon} size={ICON_SIZE} className={styles.icon} />
            요금제
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            <Icon src={settingsIcon} size={ICON_SIZE} className={styles.icon} />
            화면 설정
          </NavLink>
          <NavLink to="/help" className={navClass}>
            <Icon src={helpIcon} size={ICON_SIZE} className={styles.icon} />
            도움말
          </NavLink>
          {trashWorkspaceId !== undefined && (
            <NavLink to={`/workspaces/${trashWorkspaceId}/trash`} className={navClass}>
              <Icon src={trashIcon} size={ICON_SIZE} className={styles.icon} />
              삭제 목록
            </NavLink>
          )}
        </nav>
        <section className={styles.content} aria-labelledby="settings-section-title">
          <div className={styles.sectionTitle}>
            <h2 id="settings-section-title" className={styles.title}>
              {title}
            </h2>
            <p className={styles.description}>{description}</p>
          </div>
          {children}
        </section>
      </div>
    </AppLayout>
  );
}
