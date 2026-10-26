import { useCallback, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dividerWsMember from '../../assets/divider-ws-member.svg';
import AppLayout from '../../components/AppLayout';
import AvatarStack from '../../components/AvatarStack';
import ConfirmDialog from '../../components/ConfirmDialog';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import { ME_USER_ID, MY_WORKSPACES, WORKSPACE_FOLDERS, WORKSPACE_MEMBERS } from '../../mocks/workspace';
import type { FolderSummary } from '../../types/workspace';
import ActionMenu from './ActionMenu';
import FolderNameModal from './FolderNameModal';
import WorkspaceMembersModal from './WorkspaceMembersModal';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import styles from './WorkspacePage.module.css';

const SMALL_ICON_SIZE = 16;
const TITLE_ICON_SIZE = 20;
const FOLDER_ICON_SIZE = 24;
const DELETE_ICON_SIZE = 27;
const MEMBER_DIVIDER_WIDTH = 224;
const CREATE_WORKSPACE_PENDING_MESSAGE = '새 워크스페이스 만들기 화면은 디자인이 나오면 연결돼요.';

type Dialog =
  | { type: 'newFolder' }
  | { type: 'rename'; folder: FolderSummary }
  | { type: 'deleteFolder'; folder: FolderSummary }
  | { type: 'members' }
  | { type: 'leave' }
  | { type: 'deleteWorkspace' };

/** REQ-028~040, 127~129, 138 워크스페이스 화면 (프로젝트 폴더 목록·멤버) */
export default function WorkspacePage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  // TODO(API 연동): GET /api/workspaces/{id}, /folders, /members. 지금은 예시 데이터를 쓴다
  const workspace = MY_WORKSPACES.find((item) => String(item.workspaceId) === workspaceId) ?? MY_WORKSPACES[0];
  const [folders, setFolders] = useState(WORKSPACE_FOLDERS);
  const [members, setMembers] = useState(WORKSPACE_MEMBERS);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [menuFolderId, setMenuFolderId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = () => setDialog(null);
  const closeSwitcher = useCallback(() => setIsSwitcherOpen(false), []);
  const closeFolderMenu = useCallback(() => setMenuFolderId(null), []);
  const switcherAnchorRef = useRef<HTMLButtonElement>(null);
  const isOwner = members.some(({ userId, isOwner: owner }) => userId === ME_USER_ID && owner);
  const notice = (text: string) => setToast({ text, variant: 'info' });

  const addFolder = (name: string) => {
    // TODO(API 연동): POST /api/workspaces/{workspaceId}/folders (REQ-039~040)
    setFolders((prev) => [...prev, { folderId: Date.now(), name, isDefault: false, meetingCount: 0 }]);
    closeDialog();
  };

  const renameFolder = (folderId: number, name: string) => {
    // TODO(API 연동): PATCH /api/folders/{folderId}
    setFolders((prev) => prev.map((folder) => (folder.folderId === folderId ? { ...folder, name } : folder)));
    closeDialog();
  };

  const deleteFolder = (folderId: number) => {
    // TODO(API 연동): DELETE /api/folders/{folderId} (REQ-058)
    setFolders((prev) => prev.filter((folder) => folder.folderId !== folderId));
    closeDialog();
  };

  return (
    <AppLayout
      className={styles.page}
      sidebarFooter={
        isOwner && (
          <button type="button" className={styles.deleteWorkspace} onClick={() => setDialog({ type: 'deleteWorkspace' })}>
            이 워크스페이스 삭제
            <Placeholder size={DELETE_ICON_SIZE} />
          </button>
        )
      }
    >
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <p className={styles.breadcrumb}>워크스페이스</p>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{workspace.name}</h1>
            <span className={styles.anchor}>
              <button
                ref={switcherAnchorRef}
                type="button"
                className={styles.iconButton}
                aria-label="워크스페이스 전환"
                aria-expanded={isSwitcherOpen}
                onClick={() => setIsSwitcherOpen((value) => !value)}
              >
                <Placeholder size={TITLE_ICON_SIZE} />
              </button>
              {isSwitcherOpen && (
                <WorkspaceSwitcher
                  workspaces={MY_WORKSPACES}
                  currentId={workspace.workspaceId}
                  anchorRef={switcherAnchorRef}
                  onSelect={(id) => {
                    // TODO(API 연동): PUT /api/workspaces/{id}/last-visited (REQ-030)
                    closeSwitcher();
                    navigate(`/workspaces/${id}`);
                  }}
                  onCreate={() => {
                    closeSwitcher();
                    notice(CREATE_WORKSPACE_PENDING_MESSAGE);
                  }}
                  onClose={closeSwitcher}
                />
              )}
            </span>
          </div>
        </div>
        <button type="button" className={styles.newFolder} onClick={() => setDialog({ type: 'newFolder' })}>
          <Placeholder size={SMALL_ICON_SIZE} />새 폴더
        </button>
      </div>

      <div className={styles.columns}>
        <section className={styles.folders} aria-labelledby="folders-title">
          <div className={styles.sectionHead}>
            <h2 id="folders-title" className={styles.sectionTitle}>
              프로젝트 폴더
            </h2>
            <span className={styles.count}>총 {folders.length}개</span>
          </div>
          <ul className={styles.folderGrid}>
            {folders.map((folder) => (
              <li key={folder.folderId} className={styles.folderCard}>
                {/* 카드 전체를 누르면 폴더로 이동한다 (REQ-038) */}
                <button
                  type="button"
                  className={styles.folderLink}
                  onClick={() => navigate(`/folders/${folder.folderId}`)}
                >
                  <Placeholder size={FOLDER_ICON_SIZE} />
                  <span className={styles.folderTexts}>
                    <span className={styles.folderName}>{folder.name}</span>
                    <span className={styles.folderMeta}>회의 {folder.meetingCount}개</span>
                  </span>
                </button>
                <FolderMenu
                  folder={folder}
                  isOpen={menuFolderId === folder.folderId}
                  onToggle={() => setMenuFolderId((id) => (id === folder.folderId ? null : folder.folderId))}
                  onClose={closeFolderMenu}
                  onRename={() => setDialog({ type: 'rename', folder })}
                  onDelete={() => setDialog({ type: 'deleteFolder', folder })}
                />
              </li>
            ))}
          </ul>
          <p className={styles.hint}>폴더를 선택하면 해당 프로젝트 폴더로 이동할 수 있어요.</p>
        </section>

        <aside className={styles.side}>
          <section className={styles.memberSection} aria-labelledby="members-title">
            <h2 id="members-title" className={styles.sectionTitle}>
              멤버
            </h2>
            <div className={styles.memberCard}>
              <div className={styles.memberSummary}>
                <div className={styles.memberHead}>
                  <span className={styles.memberLabel}>워크스페이스 멤버</span>
                  <span className={styles.memberCount}>총 {members.length}명</span>
                </div>
                <AvatarStack members={members} layout="spaced" label={`워크스페이스 멤버 ${members.length}명`} />
              </div>
              <img src={dividerWsMember} alt="" width={MEMBER_DIVIDER_WIDTH} height={1} className={styles.divider} />
              <button type="button" className={styles.rowButton} onClick={() => setDialog({ type: 'members' })}>
                멤버 권한 및 관리
                <Placeholder size={SMALL_ICON_SIZE} />
              </button>
            </div>
          </section>
          <button
            type="button"
            className={`${styles.rowButton} ${styles.leave}`}
            onClick={() => setDialog({ type: 'leave' })}
          >
            이 워크스페이스 나가기
            <Placeholder size={SMALL_ICON_SIZE} />
          </button>
        </aside>
      </div>

      {dialog?.type === 'newFolder' && (
        <FolderNameModal
          title="새 프로젝트 폴더"
          description="관리할 프로젝트 폴더를 만들어 주세요."
          submitLabel="폴더 만들기"
          siblingNames={folders.map(({ name }) => name)}
          onSubmit={addFolder}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'rename' && (
        <FolderNameModal
          title="폴더 이름 바꾸기"
          description="바꿀 폴더명을 입력해 주세요."
          submitLabel="이름 바꾸기"
          initialName={dialog.folder.name}
          siblingNames={folders.filter(({ folderId }) => folderId !== dialog.folder.folderId).map(({ name }) => name)}
          onSubmit={(name) => renameFolder(dialog.folder.folderId, name)}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'deleteFolder' && (
        // MSG-046
        <ConfirmDialog
          title="폴더를 삭제하시겠습니까?"
          message={'폴더 안의 하위 폴더, 회의, 회의록이 모두 함께 삭제되며\n되돌릴 수 없습니다.'}
          cancelLabel="취소"
          confirmLabel="삭제하기"
          isDanger
          onCancel={closeDialog}
          onConfirm={() => deleteFolder(dialog.folder.folderId)}
        />
      )}
      {dialog?.type === 'members' && (
        <WorkspaceMembersModal
          members={members}
          canManage={isOwner}
          onChange={setMembers}
          onNotice={notice}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'leave' &&
        (isOwner ? (
          // MSG-042 소유자는 소유권을 넘긴 뒤에 나갈 수 있다
          <ConfirmDialog
            title="소유권을 양도해야 워크스페이스에서 나갈 수 있습니다."
            message="다른 멤버에게 소유권을 양도한 후 다시 시도해 주세요."
            cancelLabel="취소"
            confirmLabel="소유권 양도"
            onCancel={closeDialog}
            onConfirm={() => setDialog({ type: 'members' })}
          />
        ) : (
          // MSG-041
          <ConfirmDialog
            title="워크스페이스에서 나가시겠습니까?"
            message={'나가면 이 워크스페이스의 폴더와 회의록을 더 이상 볼 수 없습니다.\n다시 참여하려면 초대를 받아야 합니다.'}
            cancelLabel="취소"
            confirmLabel="나가기"
            // TODO(API 연동): DELETE /api/workspaces/{workspaceId}/members/me (REQ-032)
            onCancel={closeDialog}
            onConfirm={() => navigate('/home', { replace: true })}
          />
        ))}
      {dialog?.type === 'deleteWorkspace' && (
        // MSG-043
        <ConfirmDialog
          title="워크스페이스를 삭제하시겠습니까?"
          message={'워크스페이스 안의 모든 폴더, 회의, 회의록이 함께 삭제되며\n되돌릴 수 없습니다.'}
          cancelLabel="취소"
          confirmLabel="삭제하기"
          isDanger
          // TODO(API 연동): 워크스페이스 삭제 API (REQ-138, 백엔드 미구현)
          onCancel={closeDialog}
          onConfirm={() => navigate('/home', { replace: true })}
        />
      )}
    </AppLayout>
  );
}

interface FolderMenuProps {
  folder: FolderSummary;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/** 폴더 카드 오른쪽 위 더보기. 기본 폴더는 지울 수 없다 (REQ-044) */
function FolderMenu({ folder, isOpen, onToggle, onClose, onRename, onDelete }: FolderMenuProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const items = [{ label: '이름 바꾸기', onSelect: onRename }];
  if (!folder.isDefault) {
    items.push({ label: '폴더 삭제', onSelect: onDelete });
  }

  return (
    <span className={styles.anchor}>
      <button
        ref={anchorRef}
        type="button"
        className={styles.iconButton}
        aria-label={`${folder.name} 더보기`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <Placeholder size={SMALL_ICON_SIZE} />
      </button>
      {isOpen && <ActionMenu label={`${folder.name} 메뉴`} items={items} anchorRef={anchorRef} onClose={onClose} />}
    </span>
  );
}
