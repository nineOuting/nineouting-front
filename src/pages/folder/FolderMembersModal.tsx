import { useState } from 'react';
import { errorMessage } from '../../api/client';
import dividerModal from '../../assets/divider-modal.svg';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import Dialog from '../../components/Dialog';
import TextField from '../../components/TextField';
import type { FolderMember, WorkspaceMember } from '../../types/workspace';
import MemberChips from '../meeting/MemberChips';
import { MemberIdentity } from '../workspace/MembersModal';
import styles from '../workspace/MembersModal.module.css';

// MSG-032
const NO_MATCH_MESSAGE = '일치하는 멤버가 없어요. 이름이나 이메일을 다시 확인해 주세요.';
const DIVIDER_WIDTH = 542;

interface FolderMembersModalProps {
  members: FolderMember[];
  /** 폴더에는 워크스페이스 멤버만 초대할 수 있다 (REQ-041). 못 받았으면 null */
  workspaceMembers: WorkspaceMember[] | null;
  /** 워크스페이스 멤버 목록을 못 받은 이유 (멤버 추가 창에서 보여 준다) */
  workspaceMembersError?: string;
  /** 추가, 제외는 프로젝트 소유자와 워크스페이스 소유자. 아니면 보기 전용 */
  canManage: boolean;
  /** 실패하면 던진다 */
  onAdd: (userIds: number[]) => Promise<void>;
  onRemove: (userIds: number[]) => Promise<void>;
  onNotice: (text: string) => void;
  onClose: () => void;
}

/**
 * REQ-041, 042 프로젝트 멤버 관리 (피그마 04 프로젝트 ProjectMemberPage, 11/24 변경: 멤버 추가 중심, 소유권은 설정으로).
 * [멤버 추가]를 누르면 워크스페이스 멤버 중에서 골라 추가하는 창, 줄마다 [제외]
 */
export default function FolderMembersModal({
  members,
  workspaceMembers,
  workspaceMembersError,
  canManage,
  onAdd,
  onRemove,
  onNotice,
  onClose,
}: FolderMembersModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  // MSG-033 제외할 멤버 (확인 창)
  const [removing, setRemoving] = useState<FolderMember>();

  const remove = async (member: FolderMember) => {
    setRemoving(undefined);
    try {
      await onRemove([member.userId]);
    } catch (error) {
      onNotice(errorMessage(error));
    }
  };

  if (isAdding) {
    return (
      <AddMembersDialog
        candidates={(workspaceMembers ?? []).filter(({ userId }) => !members.some((member) => member.userId === userId))}
        loadError={workspaceMembersError}
        onAdd={async (userIds) => {
          await onAdd(userIds);
          // MSG-096 뒤 추가 창이 닫히고 멤버 관리 창으로 돌아온다
          setIsAdding(false);
        }}
        onClose={() => setIsAdding(false)}
      />
    );
  }

  return (
    <>
      <Dialog
        title="멤버 관리"
        description={canManage ? '이 프로젝트에 참여하는 멤버를 추가하거나 제외할 수 있어요' : '이 프로젝트에 참여하는 멤버를 볼 수 있어요'}
        width="md"
        onClose={onClose}
      >
        {canManage && (
          <>
            {/* 피그마 AddMemberRow: 안내 + [멤버 추가] */}
            <div className={styles.addHintRow}>
              <span>워크스페이스 멤버 중에서 골라 추가해요</span>
              <Button size="md" onClick={() => setIsAdding(true)}>
                멤버 추가
              </Button>
            </div>
            <div className={styles.divider} />
          </>
        )}
        <section className={styles.section} aria-labelledby="folder-members-title">
          <div className={styles.sectionHead}>
            <h3 id="folder-members-title" className={styles.sectionTitle}>
              참여 중인 멤버
            </h3>
            <span className={styles.count}>총 {members.length}명</span>
          </div>
          <ul className={styles.list}>
            {members.map((member) => (
              <li key={member.userId} className={styles.row}>
                <MemberIdentity member={member} email={member.email} />
                {member.isOwner ? (
                  <span className={styles.ownerBadge}>소유자</span>
                ) : (
                  // "모든 폴더" 권한으로 들어오는 멤버는 여기서 제외할 수 없다 (REQ-042, 서버가 막는다)
                  canManage &&
                  !member.isInherited && (
                    <button type="button" className={`${styles.textButton} ${styles.removeButton}`} onClick={() => setRemoving(member)}>
                      제외
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      </Dialog>
      {removing && (
        // MSG-033 (피그마 "프로젝트 멤버 제외 확인")
        <ConfirmDialog
          title={`'${removing.name}' 님을 프로젝트에서 제외할까요?`}
          message="제외하면 이 프로젝트의 회의와 회의록을 볼 수 없어요. 필요하면 다시 추가할 수 있어요."
          cancelLabel="취소"
          confirmLabel="제외하기"
          isDanger
          onCancel={() => setRemoving(undefined)}
          onConfirm={() => void remove(removing)}
        />
      )}
    </>
  );
}

interface AddMembersDialogProps {
  candidates: WorkspaceMember[];
  loadError?: string;
  /** 실패하면 던진다 */
  onAdd: (userIds: number[]) => Promise<void>;
  onClose: () => void;
}

/**
 * REQ-041 멤버 추가 (피그마 ProjectMemberAddPage). 워크스페이스 멤버가 처음부터 보이고(11/23 코멘트), 검색으로 좁힌다.
 * 고른 멤버는 아래 이름표로, [N명 추가하기]
 */
function AddMembersDialog({ candidates, loadError, onAdd, onClose }: AddMembersDialogProps) {
  const [query, setQuery] = useState('');
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const keyword = query.trim().toLowerCase();
  const shown = candidates.filter(
    ({ name, email }) => !keyword || name.toLowerCase().includes(keyword) || email.toLowerCase().includes(keyword),
  );
  const picked = candidates.filter(({ userId }) => pickedIds.includes(userId));
  const isAllPicked = shown.length > 0 && shown.every(({ userId }) => pickedIds.includes(userId));

  const toggle = (userId: number, checked: boolean) =>
    setPickedIds((prev) => (checked ? [...prev, userId] : prev.filter((id) => id !== userId)));

  const add = async () => {
    setIsSaving(true);
    setError(undefined);
    try {
      await onAdd(pickedIds);
    } catch (caught) {
      setError(errorMessage(caught));
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      title="멤버 추가"
      description="워크스페이스 멤버 중에서 이 프로젝트에 초대할 사람을 골라 주세요"
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button size="md" isLoading={isSaving} disabled={isSaving || pickedIds.length === 0} onClick={() => void add()}>
            {pickedIds.length > 0 ? `${pickedIds.length}명 추가하기` : '추가하기'}
          </Button>
        </>
      }
    >
      <TextField
        aria-label="이름 또는 이메일로 검색"
        placeholder="이름 또는 이메일로 검색"
        value={query}
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length === 0 ? (
        // MSG-032 검색 결과 자리에 회색 안내 (목록을 못 받았으면 그 이유)
        <p className={styles.addEmpty}>{loadError ?? NO_MATCH_MESSAGE}</p>
      ) : (
        <>
          <label className={styles.selectAll}>
            <input
              type="checkbox"
              className={`${styles.check} ${styles.checkLarge}`}
              checked={isAllPicked}
              onChange={(event) => {
                const ids = shown.map(({ userId }) => userId);
                setPickedIds((prev) =>
                  event.target.checked ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id)),
                );
              }}
            />
            전체 선택 ({shown.filter(({ userId }) => pickedIds.includes(userId)).length}/{shown.length})
          </label>
          <ul className={styles.list}>
            {shown.map((member) => (
              <li key={member.userId} className={styles.row}>
                <label className={styles.rowLead}>
                  <input
                    type="checkbox"
                    className={styles.check}
                    aria-label={`${member.name} 선택`}
                    checked={pickedIds.includes(member.userId)}
                    onChange={(event) => toggle(member.userId, event.target.checked)}
                  />
                  <MemberIdentity member={member} email={member.email} />
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {picked.length > 0 && (
        <>
          <img src={dividerModal} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />
          <div className={styles.selected}>
            <span>선택한 멤버 {picked.length}명</span>
            <MemberChips members={picked} onRemove={(member) => toggle(member.userId, false)} />
          </div>
        </>
      )}
      {error && (
        <p className={`${styles.empty} ${styles.danger}`} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
