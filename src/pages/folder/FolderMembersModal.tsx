import { useState } from 'react';
import dividerModal from '../../assets/divider-modal.svg';
import TopConfirm from '../../components/TopConfirm';
import type { FolderMember, WorkspaceMember } from '../../types/workspace';
import MemberChips from '../meeting/MemberChips';
import MembersModal, { MemberIdentity } from '../workspace/MembersModal';
import styles from '../workspace/MembersModal.module.css';

// MSG-032
const NO_MATCH_MESSAGE = '일치하는 멤버가 없습니다. 이름이나 이메일을 다시 확인해 주세요.';
const TRANSFER_PENDING_MESSAGE = '소유권 양도 화면은 디자인이 나오면 연결돼요.';
const DIVIDER_WIDTH = 542;

interface FolderMembersModalProps {
  members: FolderMember[];
  /** 폴더에는 워크스페이스 멤버만 초대할 수 있다 (REQ-041) */
  workspaceMembers: WorkspaceMember[];
  canManage: boolean;
  onChange: (members: FolderMember[]) => void;
  onNotice: (text: string) => void;
  onClose: () => void;
}

interface SelectableRow {
  userId: number;
  name: string;
  email: string;
}

/** REQ-041~043 프로젝트 폴더 멤버 권한 관리. 검색하면 추가할 멤버를, 아니면 참여 중인 멤버를 보여 준다 */
export default function FolderMembersModal({
  members,
  workspaceMembers,
  canManage,
  onChange,
  onNotice,
  onClose,
}: FolderMembersModalProps) {
  const [query, setQuery] = useState('');
  const [toAdd, setToAdd] = useState<SelectableRow[]>([]);
  const [toRemove, setToRemove] = useState<number[]>([]);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const keyword = query.trim().toLowerCase();
  const isSearching = keyword.length > 0;

  const candidates = workspaceMembers.filter(
    ({ userId, name, email }) =>
      !members.some((member) => member.userId === userId) &&
      (name.toLowerCase().includes(keyword) || email.toLowerCase().includes(keyword)),
  );
  const removable = members.filter(({ isOwner }) => !isOwner);

  const addSelected = () => {
    if (toAdd.length === 0) {
      return;
    }
    // TODO(API 연동): POST /api/folders/{folderId}/members (REQ-041)
    onChange([...members, ...toAdd.map((member) => ({ ...member, isOwner: false }))]);
    setToAdd([]);
    setQuery('');
  };

  const removeSelected = () => {
    // TODO(API 연동): DELETE /api/folders/{folderId}/members/{userId} (REQ-042)
    onChange(members.filter(({ userId }) => !toRemove.includes(userId)));
    setToRemove([]);
    setIsRemoveConfirmOpen(false);
  };

  return (
    <>
      <MembersModal
        description="프로젝트에 참여할 멤버와 접근 권한을 관리할 수 있어요. 워크스페이스 내 멤버만 초대할 수 있어요."
        inputPlaceholder="이름 또는 이메일로 멤버 검색"
        inputValue={query}
        onInputChange={setQuery}
        onAdd={addSelected}
        canManage={canManage}
        ownershipLabel="프로젝트 소유권 관리"
        onTransferOwnership={() => onNotice(TRANSFER_PENDING_MESSAGE)}
        onClose={onClose}
      >
        {isSearching ? (
          <>
            <section className={styles.section} aria-label="추가할 멤버">
              <SelectionList
                rows={candidates}
                selectedIds={toAdd.map(({ userId }) => userId)}
                actionLabel="선택 삭제"
                emptyText={NO_MATCH_MESSAGE}
                onChange={(ids) => setToAdd(candidates.filter(({ userId }) => ids.includes(userId)))}
                onAction={() => setToAdd([])}
              />
            </section>
            {toAdd.length > 0 && (
              <div className={styles.selected}>
                <span>선택한 멤버 {toAdd.length}명</span>
                <MemberChips
                  members={toAdd}
                  onRemove={(member) => setToAdd((prev) => prev.filter(({ userId }) => userId !== member.userId))}
                />
              </div>
            )}
          </>
        ) : (
          <section className={styles.section} aria-labelledby="folder-members-title">
            <div className={styles.sectionHead}>
              <h3 id="folder-members-title" className={styles.sectionTitle}>
                참여중인 멤버
              </h3>
              <span className={styles.count}>총 {members.length}명</span>
            </div>
            {canManage ? (
              <SelectionList
                rows={removable}
                selectedIds={toRemove}
                actionLabel="선택 멤버 제외"
                isDanger
                owners={members.filter(({ isOwner }) => isOwner)}
                emptyText=""
                onChange={setToRemove}
                onAction={() => setIsRemoveConfirmOpen(true)}
              />
            ) : (
              <ul className={styles.list}>
                {members.map((member) => (
                  <li key={member.userId} className={styles.row}>
                    <MemberIdentity member={member} email={member.email} />
                    {member.isOwner && <span className={styles.ownerBadge}>소유자</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </MembersModal>
      {isRemoveConfirmOpen && (
        // MSG-033
        <TopConfirm
          title="멤버를 프로젝트에서 제외할까요?"
          message="제외한 멤버는 프로젝트와 접근 권한이 없는 하위 폴더를 더 이상 확인할 수 없어요."
          confirmLabel="제외하기"
          onCancel={() => setIsRemoveConfirmOpen(false)}
          onConfirm={removeSelected}
        />
      )}
    </>
  );
}

interface SelectionListProps {
  rows: SelectableRow[];
  selectedIds: number[];
  actionLabel: string;
  isDanger?: boolean;
  /** 맨 위에 체크 칸 없이 보여 줄 소유자 (제외할 수 없다, REQ-042) */
  owners?: SelectableRow[];
  emptyText: string;
  onChange: (ids: number[]) => void;
  onAction: () => void;
}

/** 전체선택 (n/N) 줄과 체크 칸이 달린 멤버 목록 */
function SelectionList({
  rows,
  selectedIds,
  actionLabel,
  isDanger,
  owners = [],
  emptyText,
  onChange,
  onAction,
}: SelectionListProps) {
  const isAllSelected = rows.length > 0 && selectedIds.length === rows.length;
  const toggle = (userId: number, checked: boolean) =>
    onChange(checked ? [...selectedIds, userId] : selectedIds.filter((id) => id !== userId));

  return (
    <>
      <div className={styles.selectRow}>
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            className={`${styles.check} ${styles.checkLarge}`}
            checked={isAllSelected}
            disabled={rows.length === 0}
            onChange={(event) => onChange(event.target.checked ? rows.map(({ userId }) => userId) : [])}
          />
          전체선택 ({selectedIds.length}/{rows.length + owners.length})
        </label>
        <button
          type="button"
          className={[styles.textButton, isDanger ? styles.danger : ''].filter(Boolean).join(' ')}
          disabled={selectedIds.length === 0}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>
      <img src={dividerModal} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />
      <ul className={styles.list}>
        {owners.map((owner) => (
          <li key={owner.userId} className={styles.row}>
            <MemberIdentity member={owner} email={owner.email} />
            <span className={styles.ownerBadge}>소유자</span>
          </li>
        ))}
        {rows.length === 0 && emptyText && <li className={styles.empty}>{emptyText}</li>}
        {rows.map((row) => (
          <li key={row.userId} className={styles.row}>
            <label className={styles.rowLead}>
              <input
                type="checkbox"
                className={styles.check}
                aria-label={`${row.name} 선택`}
                checked={selectedIds.includes(row.userId)}
                onChange={(event) => toggle(row.userId, event.target.checked)}
              />
              <MemberIdentity member={row} email={row.email} />
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
