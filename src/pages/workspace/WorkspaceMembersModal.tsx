import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import {
  cancelInvitation,
  listPendingInvitations,
  resendInvitation,
  type PendingInvitation,
} from '../../api/workspace';
import DropdownMenu from '../../components/DropdownMenu';
import chevronIcon from '../../assets/icons/chevron-up-sm.svg';
import copyIcon from '../../assets/icons/copy.svg';
import deleteIcon from '../../assets/icons/delete.svg';
import moreIcon from '../../assets/icons/more-vert.svg';
import Icon from '../../components/Icon';
import { EMAIL_REGEX, MESSAGES } from '../../constants/auth';
import type { FolderAccess, WorkspaceMember } from '../../types/workspace';
import ActionMenu from './ActionMenu';
import MembersModal, { MemberIdentity } from './MembersModal';
import TransferOwnerDialog from './TransferOwnerDialog';
import styles from './MembersModal.module.css';

const ICON_SIZE = 16;
const MORE_ICON_SIZE = 20;

const ACCESS_LABELS: Record<FolderAccess, string> = {
  all: '모든 폴더 접근 가능',
  invited: '초대된 폴더만 접근 가능',
};

interface WorkspaceMembersModalProps {
  workspaceId: number;
  members: WorkspaceMember[];
  canManage: boolean;
  /** 실패하면 던진다. 메시지를 입력 칸 아래에 보여 준다 */
  onInvite: (email: string) => Promise<void>;
  /** REQ-034 초대 링크를 새로 받아 복사한다 */
  onCopyInviteLink: () => void;
  onAccessChange: (userId: number, access: FolderAccess) => void;
  onRemove: (userId: number) => void;
  /** REQ-129 소유권 양도. 실패하면 던진다 */
  onTransfer: (userId: number) => Promise<void>;
  onNotice: (text: string) => void;
  onClose: () => void;
}

/** REQ-033, 034, 036, 127~129 워크스페이스 멤버 권한 관리. 이메일 초대와 초대 링크 복사 */
export default function WorkspaceMembersModal({
  workspaceId,
  members,
  canManage,
  onInvite,
  onCopyInviteLink,
  onAccessChange,
  onRemove,
  onTransfer,
  onNotice,
  onClose,
}: WorkspaceMembersModalProps) {
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [isInviting, setIsInviting] = useState(false);
  // REQ-164 초대 대기 (소유자만 본다). null이면 불러오는 중
  const [pending, setPending] = useState<PendingInvitation[] | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<number | null>(null);

  const loadPending = useCallback(
    () =>
      listPendingInvitations(workspaceId)
        .then(setPending)
        // 목록을 받지 못해도 멤버 관리는 할 수 있게 비워 둔다
        .catch(() => setPending([])),
    [workspaceId],
  );

  useEffect(() => {
    if (canManage) {
      void loadPending();
    }
  }, [canManage, loadPending]);

  const handlePending = async (invitation: PendingInvitation, action: 'resend' | 'cancel') => {
    setBusyInvitationId(invitation.invitationId);
    try {
      if (action === 'resend') {
        await resendInvitation(workspaceId, invitation.invitationId);
        // MSG-061
        onNotice('초대 메일을 1명에게 보냈어요.');
      } else {
        await cancelInvitation(workspaceId, invitation.invitationId);
        onNotice(`${invitation.email} 초대를 취소했어요.`);
      }
      await loadPending();
    } catch (error) {
      onNotice(errorMessage(error));
    } finally {
      setBusyInvitationId(null);
    }
  };

  const invite = async () => {
    const value = email.trim();
    if (!EMAIL_REGEX.test(value)) {
      setEmailError(MESSAGES.invalidEmail);
      return;
    }
    if (isInviting) {
      return;
    }
    setIsInviting(true);
    try {
      await onInvite(value);
      setEmail('');
      await loadPending();
    } catch (error) {
      setEmailError(errorMessage(error));
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <MembersModal
      description="워크스페이스에 참여할 멤버와 접근 권한을 관리할 수 있어요"
      help={
        <>
          <p className={styles.helpTitle}>권한 안내</p>
          <p>· 모든 폴더 접근: 워크스페이스의 모든 폴더와 회의록을 볼 수 있어요</p>
          <p>· 초대된 폴더만: 초대받은 폴더의 회의록만 볼 수 있어요</p>
        </>
      }
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
      onTransferOwnership={() => setIsTransferOpen(true)}
      onClose={onClose}
    >
      {canManage && (
        // 디자인 CreateWorkspaceModal의 초대 링크 줄과 같은 모양
        <div className={styles.footer}>
          <span>초대 링크로도 멤버를 부를 수 있어요 (1일 동안 쓸 수 있어요)</span>
          <button type="button" className={styles.transfer} onClick={onCopyInviteLink}>
            <Icon src={copyIcon} size={ICON_SIZE} />
            초대 링크 복사
          </button>
        </div>
      )}
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
              onAccessChange={(folderAccess) => onAccessChange(member.userId, folderAccess)}
              onRemove={() => onRemove(member.userId)}
            />
          ))}
        </ul>
      </section>
      {canManage && pending && pending.length > 0 && (
        // REQ-164 이메일로 초대했지만 아직 수락하지 않은 사람
        <section className={styles.section} aria-labelledby="workspace-pending-title">
          <div className={styles.sectionHead}>
            <h3 id="workspace-pending-title" className={styles.sectionTitle}>
              초대 대기
            </h3>
            <span className={styles.count}>총 {pending.length}명</span>
          </div>
          <ul className={styles.list}>
            {pending.map((invitation) => (
              <li key={invitation.invitationId} className={styles.row}>
                <span className={styles.identityText}>
                  <span className={styles.memberName}>{invitation.email}</span>
                  <span className={styles.memberEmail}>
                    {invitation.expired ? '초대 링크가 만료됐어요' : '메일 속 링크로 수락하기를 기다리고 있어요'}
                  </span>
                </span>
                <span className={styles.pendingActions}>
                  <span className={invitation.expired ? styles.expiredBadge : styles.pendingBadge}>
                    {invitation.expired ? '만료' : '초대 대기'}
                  </span>
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={busyInvitationId === invitation.invitationId}
                    onClick={() => void handlePending(invitation, 'resend')}
                  >
                    다시 보내기
                  </button>
                  <button
                    type="button"
                    className={`${styles.textButton} ${styles.danger}`}
                    disabled={busyInvitationId === invitation.invitationId}
                    onClick={() => void handlePending(invitation, 'cancel')}
                  >
                    취소
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {isTransferOpen && (
        <TransferOwnerDialog
          target="워크스페이스"
          candidates={members.filter(({ isOwner }) => !isOwner)}
          onTransfer={async (userId) => {
            await onTransfer(userId);
            setIsTransferOpen(false);
          }}
          onClose={() => setIsTransferOpen(false)}
        />
      )}
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
              <Icon src={moreIcon} size={MORE_ICON_SIZE} />
            </button>
            {openMenu === 'more' && (
              <ActionMenu
                label={`${member.name} 메뉴`}
                anchorRef={moreRef}
                // REQ-036 워크스페이스에서 제외
                items={[{ label: '워크스페이스에서 제외', icon: deleteIcon, isDanger: true, onSelect: onRemove }]}
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
          <Icon src={chevronIcon} size={ICON_SIZE} className={openMenu === 'access' ? undefined : styles.flipped} />
        </button>
        {openMenu === 'access' && (
          <DropdownMenu
            label="폴더 접근 권한"
            emptyText=""
            anchorRef={accessRef}
            className={styles.accessMenu}
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

