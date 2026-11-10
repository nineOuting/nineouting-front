import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { getUnreadCount } from '../api/notification';
import { getMe, type Me } from '../api/user';
import planIcon from '../assets/icons/template-sm.svg';
import logoutIcon from '../assets/icons/logout.svg';
import settingsIcon from '../assets/icons/menu-settings.svg';
import notificationsIcon from '../assets/icons/notifications.svg';
import personIcon from '../assets/icons/person.svg';
import Icon from './Icon';
import menu from './Menu.module.css';
import NotificationPanel from './NotificationPanel';
import styles from './AppLayout.module.css';

const TOP_ICON_SIZE = 24;
const MENU_ICON_SIZE = 20;
const AVATAR_SIZE = 32;
const MENU_AVATAR_SIZE = 40;
const BADGE_MAX = 99;

function Avatar({ me, size }: { me: Me; size: number }) {
  return me.profileImageUrl ? (
    <img src={me.profileImageUrl} alt="" width={size} height={size} className={styles.avatar} />
  ) : (
    <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true" />
  );
}

/** 상단 바 오른쪽 알림과 프로필 메뉴 (디자인 UserActions). 앱 화면과 회의록, 양식 편집 화면이 함께 쓴다 */
export default function TopBarUser() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me>();
  const [unread, setUnread] = useState(0);
  const [openPanel, setOpenPanel] = useState<'notifications' | 'profile' | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => setOpenPanel(null), []);

  useEffect(() => {
    let isCurrent = true;
    getMe()
      .then((loaded) => isCurrent && setMe(loaded))
      .catch(() => undefined);
    getUnreadCount()
      .then((count) => isCurrent && setUnread(count))
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, []);

  // 프로필 메뉴는 바깥을 누르거나 Esc로 닫는다
  useEffect(() => {
    if (openPanel !== 'profile') {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!profileMenuRef.current?.contains(target) && !profileRef.current?.contains(target)) {
        closePanel();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPanel, closePanel]);

  const toggle = (panel: 'notifications' | 'profile') => setOpenPanel((current) => (current === panel ? null : panel));

  // REQ-003 로그아웃
  const signOut = async () => {
    closePanel();
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className={styles.actions}>
      <span className={styles.anchor}>
        <button
          ref={bellRef}
          type="button"
          className={styles.iconButton}
          aria-label={unread > 0 ? `알림 ${unread}개 안 읽음` : '알림'}
          aria-expanded={openPanel === 'notifications'}
          onClick={() => toggle('notifications')}
        >
          <Icon src={notificationsIcon} size={TOP_ICON_SIZE} />
          {unread > 0 && <span className={styles.badge}>{Math.min(unread, BADGE_MAX)}</span>}
        </button>
        {openPanel === 'notifications' && (
          <NotificationPanel anchorRef={bellRef} onUnreadChange={setUnread} onClose={closePanel} />
        )}
      </span>
      {me && (
        <span className={styles.anchor}>
          <button
            ref={profileRef}
            type="button"
            className={styles.profile}
            aria-haspopup="menu"
            aria-expanded={openPanel === 'profile'}
            onClick={() => toggle('profile')}
          >
            <Avatar me={me} size={AVATAR_SIZE} />
            <span className={styles.name}>{me.name}</span>
          </button>
          {openPanel === 'profile' && (
            <div ref={profileMenuRef} role="menu" aria-label="내 메뉴" className={`${menu.menu} ${styles.profileMenu}`}>
              <div className={styles.profileHeader}>
                <Avatar me={me} size={MENU_AVATAR_SIZE} />
                <span className={styles.profileTexts}>
                  <span className={styles.profileName}>{me.name}</span>
                  <span className={styles.profileEmail}>{me.email}</span>
                </span>
              </div>
              <div className={menu.divider} />
              <button type="button" role="menuitem" className={menu.item} onClick={() => navigate('/profile')}>
                <Icon src={personIcon} size={MENU_ICON_SIZE} className={menu.itemIcon} />
                프로필
              </button>
              {/* REQ-003 요금제 (REQ-176) */}
              <button type="button" role="menuitem" className={menu.item} onClick={() => navigate('/plan')}>
                <Icon src={planIcon} size={MENU_ICON_SIZE} className={menu.itemIcon} />
                요금제
              </button>
              <button type="button" role="menuitem" className={menu.item} onClick={() => navigate('/settings')}>
                <Icon src={settingsIcon} size={MENU_ICON_SIZE} className={menu.itemIcon} />
                화면 설정
              </button>
              <div className={menu.divider} />
              <button type="button" role="menuitem" className={menu.item} onClick={signOut}>
                <Icon src={logoutIcon} size={MENU_ICON_SIZE} className={menu.itemIcon} />
                로그아웃
              </button>
            </div>
          )}
        </span>
      )}
    </div>
  );
}
