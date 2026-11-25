import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import {
  cancelInvitation,
  listPendingInvitations,
  resendInvitation,
  type PendingInvitation,
} from '../../api/workspace';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DropdownMenu from '../../components/DropdownMenu';
import chevronIcon from '../../assets/icons/chevron-up-sm.svg';
import Icon from '../../components/Icon';
import TextField from '../../components/TextField';
import { EMAIL_REGEX, MESSAGES } from '../../constants/auth';
import type { FolderAccess, WorkspaceMember } from '../../types/workspace';
import MembersModal, { MemberIdentity } from './MembersModal';
import styles from './MembersModal.module.css';

const ICON_SIZE = 16;
// 권한 칩 메뉴의 [워크스페이스에서 내보내기] (REQ-036)
const REMOVE_ID = 'remove';
const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

const ACCESS_LABELS: Record<FolderAccess, string> = {
  all: '모든 폴더 접근 가능',
  invited: '초대된 폴더만 접근 가능',
};

interface WorkspaceMembersModalProps {
  workspaceId: number;
  members: WorkspaceMember[];
  canManage: boolean;
  /** 내 줄에는 권한 버튼을 두지 않는다 */
  myUserId?: number | null;
  /** 실패하면 던진다. 메시지를 입력 칸 아래에 보여 준다 */
  onInvite: (email: string) => Promise<void>;
  /** REQ-034 초대 링크를 새로 받아 복사한다. 받은 링크를 돌려준다 (실패하면 undefined) */
  onCopyInviteLink: () => Promise<string | undefined>;
  onAccessChange: (userId: number, access: FolderAccess) => void;
  onRemove: (userId: number) => void;
  onNotice: (text: string) => void;
  onClose: () => void;
}

/**
 * REQ-033, 034, 036, 127, 128 워크스페이스 멤버 관리 (피그마 03 워크스페이스 MemberManageModal, 11/24).
 * 소유자: 이메일 초대, 초대 링크 복사, 초대 대기, 권한 칩(내보내기 포함). 소유자가 아니면 보기 전용.
 * 소유권 양도는 설정 창에서 한다 (REQ-129)
 */
export default function WorkspaceMembersModal({
  workspaceId,
  members,
  canManage,
  myUserId,
  onInvite,
  onCopyInviteLink,
  onAccessChange,
  onRemove,
  onNotice,
  onClose,
}: WorkspaceMembersModalProps) {
  // 마지막으로 복사한 초대 링크 (링크 칸에 보여 준다). 창을 열 때마다 새로 만들면 이전 링크가 막혀 누를 때만 만든다
  const [inviteLink, setInviteLink] = useState('');
  // MSG-097 내보낼 멤버 (확인 창)
  const [removing, setRemoving] = useState<WorkspaceMember>();
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
      description={canManage ? '워크스페이스에 참여할 멤버와 접근 권한을 관리할 수 있어요' : '워크스페이스 멤버와 접근 권한을 볼 수 있어요'}
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
      afterAdd={
        // 피그마 InviteLinkRow: 링크 칸 + [링크 복사], 아래 안내
        <div className={styles.linkRow}>
          <div className={styles.linkField}>
            <TextField
              aria-label="초대 링크"
              readOnly
              value={inviteLink}
              placeholder="[링크 복사]를 누르면 초대 링크를 만들어요"
              helper="링크는 1일 동안 쓸 수 있어요. 새로 만들면 이전 링크는 막혀요"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => void onCopyInviteLink().then((url) => url && setInviteLink(url.replace(/^https?:\/\//, '')))}
          >
            링크 복사
          </Button>
        </div>
      }
      canManage={canManage}
      canTransfer={false}
      ownershipLabel=""
      onTransferOwnership={() => undefined}
      onClose={onClose}
    >
      {canManage && pending && pending.length > 0 && (
        // REQ-164 이메일로 초대했지만 아직 수락하지 않은 사람 (피그마: 참여 중인 멤버 위, 제목 없이)
        <ul className={styles.list} aria-label="초대 대기">
          {pending.map((invitation) => (
            <li key={invitation.invitationId} className={styles.row}>
              <span className={styles.identity}>
                <span className={styles.avatar} aria-hidden="true" />
                <span className={styles.identityText}>
                  <span className={styles.memberName}>{invitation.email}</span>
                  <span className={styles.memberEmail}>
                    {invitation.expired ? '초대 링크가 만료됐어요' : `${DATE_FORMAT.format(new Date(invitation.invitedAt))} 초대함`}
                  </span>
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
                  className={styles.textButton}
                  disabled={busyInvitationId === invitation.invitationId}
                  onClick={() => void handlePending(invitation, 'cancel')}
                >
                  취소
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <section className={styles.section} aria-labelledby="workspace-members-title">
        <div className={styles.sectionHead}>
          <h3 id="workspace-members-title" className={styles.sectionTitle}>
            참여 중인 멤버
          </h3>
          <span className={styles.count}>총 {members.length}명</span>
        </div>
        <ul className={styles.list}>
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              canManage={canManage}
              isMe={member.userId === myUserId}
              onAccessChange={(folderAccess) => onAccessChange(member.userId, folderAccess)}
              onRemove={() => setRemoving(member)}
            />
          ))}
        </ul>
      </section>
      {removing && (
        <ConfirmDialog
          title={`${removing.name} 님을 워크스페이스에서 내보낼까요?`}
          message="내보내면 이 워크스페이스의 폴더와 회의록을 볼 수 없어요. 다시 들어오려면 초대를 받아야 해요"
          cancelLabel="취소"
          confirmLabel="내보내기"
          isDanger
          onCancel={() => setRemoving(undefined)}
          onConfirm={() => {
            onRemove(removing.userId);
            setRemoving(undefined);
          }}
        />
      )}
    </MembersModal>
  );
}

interface MemberRowProps {
  member: WorkspaceMember;
  canManage: boolean;
  isMe: boolean;
  onAccessChange: (access: FolderAccess) => void;
  onRemove: () => void;
}

function MemberRow({ member, canManage, isMe, onAccessChange, onRemove }: MemberRowProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const accessRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setIsMenuOpen(false);

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
      <MemberIdentity member={member} email={member.email} />
      {/* 피그마 11/24: 소유자가 아니면(보기 전용) 화살표 없는 회색 글자. 내 줄도 글자만 (디자인 체크 2026-11-19) */}
      {!canManage || isMe ? (
        <span className={styles.accessText}>{ACCESS_LABELS[member.folderAccess]}</span>
      ) : (
        <span className={styles.anchor}>
          <button
            ref={accessRef}
            type="button"
            className={styles.accessButton}
            aria-label={`${member.name} 폴더 접근 권한: ${ACCESS_LABELS[member.folderAccess]}`}
            aria-haspopup="listbox"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {ACCESS_LABELS[member.folderAccess]}
            <Icon src={chevronIcon} size={ICON_SIZE} className={isMenuOpen ? undefined : styles.flipped} />
          </button>
          {isMenuOpen && (
            // 피그마 "멤버 권한 칩 메뉴": 권한 2개 + 맨 아래 빨간 [워크스페이스에서 내보내기] (REQ-036, 128)
            <DropdownMenu
              label="폴더 접근 권한"
              emptyText=""
              anchorRef={accessRef}
              className={styles.accessMenu}
              items={[
                ...(Object.keys(ACCESS_LABELS) as FolderAccess[]).map((access) => ({
                  id: access,
                  label: ACCESS_LABELS[access],
                  isSelected: access === member.folderAccess,
                })),
                { id: REMOVE_ID, label: '워크스페이스에서 내보내기', isDanger: true, hasDividerBefore: true },
              ]}
              onSelect={(id) => {
                closeMenu();
                if (id === REMOVE_ID) {
                  onRemove();
                } else if (id !== member.folderAccess) {
                  onAccessChange(id as FolderAccess);
                }
              }}
              onClose={closeMenu}
            />
          )}
        </span>
      )}
    </li>
  );
}
