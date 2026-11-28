import Popover from './Popover';
import styles from './MemberListPopover.module.css';
import type { RefObject } from 'react';
import Avatar from './Avatar';

export interface MemberListItem {
  userId: number;
  name: string;
  profileImageUrl?: string;
  isOwner: boolean;
}

interface MemberListPopoverProps {
  anchorRef: RefObject<HTMLElement | null>;
  members: MemberListItem[] | null;
  /** 초대 대기 이메일 (워크스페이스 소유자에게만). 없으면 줄을 그리지 않는다 */
  pendingEmails?: string[];
  onClose: () => void;
}

/**
 * 피그마 프론트 "멤버 목록 팝오버" (REQ-033), "프로젝트 멤버 목록 보기": [멤버 N명]을 누르면 뜨는 보기 전용 목록.
 * 관리는 ⋮ 메뉴의 멤버 권한 관리(멤버 관리) 창에서 한다
 */
export default function MemberListPopover({ anchorRef, members, pendingEmails = [], onClose }: MemberListPopoverProps) {
  return (
    <Popover label="멤버 목록" anchorRef={anchorRef} onClose={onClose} className={styles.popover}>
      <p className={styles.title}>{members ? `멤버 ${members.length}명` : '멤버'}</p>
      {members === null ? (
        <p className={styles.loading}>불러오는 중이에요</p>
      ) : (
        <ul className={styles.list}>
          {members.map((member) => (
            <li key={member.userId} className={styles.row}>
              <Avatar url={member.profileImageUrl} className={styles.avatar} />
              <span className={styles.name}>{member.name}</span>
              <span className={styles.role}>{member.isOwner ? '소유자' : '멤버'}</span>
            </li>
          ))}
        </ul>
      )}
      {pendingEmails.length > 0 && (
        <div className={styles.pending}>
          <p className={styles.pendingTitle}>초대 대기 {pendingEmails.length}명</p>
          {pendingEmails.map((email) => (
            <p key={email} className={styles.pendingEmail}>
              {email}
            </p>
          ))}
        </div>
      )}
    </Popover>
  );
}
