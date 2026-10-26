import { useRef, useState } from 'react';
import DropdownMenu from '../../components/DropdownMenu';
import Placeholder from '../../components/Placeholder';
import { EMAIL_REGEX, MESSAGES } from '../../constants/auth';
import { REGISTERED_USERS } from '../../mocks/workspace';
import type { FolderAccess, WorkspaceMember } from '../../types/workspace';
import ActionMenu from './ActionMenu';
import MembersModal, { MemberIdentity } from './MembersModal';
import styles from './MembersModal.module.css';

const ICON_SIZE = 16;
// MSG-032
const NO_MATCH_MESSAGE = '일치하는 멤버가 없습니다. 이름이나 이메일을 다시 확인해 주세요.';
const TRANSFER_PENDING_MESSAGE = '소유권 양도 화면은 디자인이 나오면 연결돼요.';

const ACCESS_LABELS: Record<FolderAccess, string> = {
  all: '모든 폴더 접근 가능',
  invited: '초대된 폴더만 접근 가능',
};

interface WorkspaceMembersModalProps {
  members: WorkspaceMember[];
  canManage: boolean;
  onChange: (members: WorkspaceMember[]) => void;
  onNotice: (text: string) => void;
  onClose: () => void;
}

/** REQ-033, 036, 127~129 워크스페이스 멤버 권한 관리. 워크스페이스는 이메일로만 초대한다 */
export default function WorkspaceMembersModal({
  members,
  canManage,
  onChange,
  onNotice,
  onClose,
}: WorkspaceMembersModalProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();

  const invite = () => {
    const value = email.trim();
    if (!EMAIL_REGEX.test(value)) {
      setEmailError(MESSAGES.invalidEmail);
      return;
    }
    // TODO(API 연동): 이메일 초대 API (REQ-127, 백엔드 미구현). 지금은 가입한 사용자 예시에서 찾는다
    const user = REGISTERED_USERS.find((item) => item.email === value);
    if (!user) {
      setEmailError(NO_MATCH_MESSAGE);
      return;
    }
    if (!members.some(({ userId }) => userId === user.userId)) {
      onChange([...members, { ...user, isOwner: false, folderAccess: 'all' }]);
    }
    setEmail('');
  };

  const update = (userId: number, patch: Partial<WorkspaceMember>) =>
    onChange(members.map((member) => (member.userId === userId ? { ...member, ...patch } : member)));

  return (
    <MembersModal
      description="워크스페이스에 참여할 멤버와 접근 권한을 관리할 수 있어요."
      inputPlaceholder="이메일로 멤버 초대"
      inputType="email"
      inputValue={email}
      inputError={emailError}
      onInputChange={(value) => {
        setEmail(value);
        setEmailError(undefined);
      }}
      onAdd={invite}
      canManage={canManage}
      ownershipLabel="워크스페이스 소유권 관리"
      onTransferOwnership={() => onNotice(TRANSFER_PENDING_MESSAGE)}
      onClose={onClose}
    >
      <section className={styles.section} aria-labelledby="workspace-members-title">
        <div className={styles.sectionHead}>
          <h3 id="workspace-members-title" className={styles.sectionTitle}>
            참여중인 멤버
          </h3>
          <span className={styles.count}>총 {members.length}명</span>
        </div>
        <ul className={styles.list}>
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              canManage={canManage}
              onAccessChange={(folderAccess) => update(member.userId, { folderAccess })}
              onRemove={() => onChange(members.filter(({ userId }) => userId !== member.userId))}
            />
          ))}
        </ul>
      </section>
    </MembersModal>
  );
}

interface MemberRowProps {
  member: WorkspaceMember;
  canManage: boolean;
  onAccessChange: (access: FolderAccess) => void;
  onRemove: () => void;
}

function MemberRow({ member, canManage, onAccessChange, onRemove }: MemberRowProps) {
  const [openMenu, setOpenMenu] = useState<'more' | 'access' | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const accessRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setOpenMenu(null);
  const toggle = (menu: 'more' | 'access') => setOpenMenu((current) => (current === menu ? null : menu));

  if (member.isOwner) {
    return (
      <li className={styles.row}>
        <MemberIdentity member={member} email={member.email} />
        <span className={styles.ownerBadge}>소유자</span>
      </li>
    );
  }

  return (
    <li className={styles.row}>
      <span className={styles.rowLead}>
        {canManage && (
          <span className={styles.anchor}>
            <button
              ref={moreRef}
              type="button"
              className={styles.iconButton}
              aria-label={`${member.name} 더보기`}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'more'}
              onClick={() => toggle('more')}
            >
              <Placeholder size={ICON_SIZE} />
            </button>
            {openMenu === 'more' && (
              <ActionMenu
                label={`${member.name} 메뉴`}
                anchorRef={moreRef}
                // REQ-036 워크스페이스에서 제외
                // TODO(API 연동): DELETE /api/workspaces/{workspaceId}/members/{userId}
                items={[{ label: '워크스페이스에서 제외', onSelect: onRemove }]}
                onClose={closeMenu}
              />
            )}
          </span>
        )}
        <MemberIdentity member={member} email={member.email} />
      </span>
      <span className={styles.anchor}>
        <button
          ref={accessRef}
          type="button"
          className={styles.accessButton}
          aria-label={`${member.name} 폴더 접근 권한: ${ACCESS_LABELS[member.folderAccess]}`}
          aria-haspopup="listbox"
          aria-expanded={openMenu === 'access'}
          disabled={!canManage}
          onClick={() => toggle('access')}
        >
          {ACCESS_LABELS[member.folderAccess]}
          <Placeholder size={ICON_SIZE} />
        </button>
        {openMenu === 'access' && (
          <DropdownMenu
            label="폴더 접근 권한"
            emptyText=""
            anchorRef={accessRef}
            className={styles.accessMenu}
            // TODO(API 연동): 멤버별 폴더 접근 권한 API (REQ-128, 백엔드 미구현)
            items={(Object.keys(ACCESS_LABELS) as FolderAccess[]).map((access) => ({
              id: access,
              label: ACCESS_LABELS[access],
              isSelected: access === member.folderAccess,
            }))}
            onSelect={(id) => {
              onAccessChange(id as FolderAccess);
              closeMenu();
            }}
            onClose={closeMenu}
          />
        )}
      </span>
    </li>
  );
}

