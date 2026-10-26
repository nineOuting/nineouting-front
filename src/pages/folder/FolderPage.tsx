import { Fragment, useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dividerPending from '../../assets/divider-pending.svg';
import dividerPendingMeta from '../../assets/divider-pending-meta.svg';
import AppLayout from '../../components/AppLayout';
import AvatarStack from '../../components/AvatarStack';
import ConfirmDialog from '../../components/ConfirmDialog';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import { SAMPLE_FOLDER, WORKSPACE_MEMBERS } from '../../mocks/workspace';
import type { FolderMeeting } from '../../types/workspace';
import FolderNameModal from '../workspace/FolderNameModal';
import FolderMembersModal from './FolderMembersModal';
import MeetingTable from './MeetingTable';
import styles from './FolderPage.module.css';

const SMALL_ICON_SIZE = 16;
const TITLE_ICON_SIZE = 20;
const FOLDER_ICON_SIZE = 24;
const PENDING_DIVIDER_WIDTH = 208;
const PENDING_META_DIVIDER_LENGTH = 17;
const ARCHIVE_PENDING_MESSAGE = '회의록 아카이브 화면은 디자인이 나오면 연결돼요.';

type Dialog = { type: 'newFolder' } | { type: 'members' } | { type: 'leave' };

/** 회의 상태에 따라 대기 화면·회의방·회의록으로 간다 */
function meetingPath({ meetingId, status }: FolderMeeting) {
  if (status === 'inProgress') {
    return `/meetings/${meetingId}/room`;
  }
  // TODO(API 연동): 끝난 회의는 회의록 화면으로 (회의록 화면이 생기면)
  return `/meetings/${meetingId}`;
}

/** REQ-041~058, 139 프로젝트 폴더 화면 (하위 폴더·회의 목록·멤버·남은 안건) */
export default function FolderPage() {
  const navigate = useNavigate();
  const { folderId } = useParams();
  // TODO(API 연동): GET /api/folders/{folderId}, /members, 회의 목록, 남은 안건. 지금은 예시 데이터를 쓴다
  const folder = SAMPLE_FOLDER;
  const [subFolders, setSubFolders] = useState(folder.subFolders);
  const [members, setMembers] = useState(folder.members);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = () => setDialog(null);
  const notice = (text: string) => setToast({ text, variant: 'info' });

  const addSubFolder = (name: string) => {
    // TODO(API 연동): POST /api/workspaces/{workspaceId}/folders (parentId) (REQ-046~047)
    setSubFolders((prev) => [...prev, { folderId: Date.now(), name, isDefault: false, meetingCount: 0 }]);
    closeDialog();
  };

  return (
    <AppLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <nav className={styles.breadcrumb} aria-label="현재 위치">
            <button type="button" className={styles.crumb} onClick={() => navigate(`/workspaces/${folder.workspaceId}`)}>
              워크스페이스
            </button>
            <Placeholder size={SMALL_ICON_SIZE} />
            <span aria-current="page">{folder.name}</span>
          </nav>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{folder.name}</h1>
            <Placeholder size={TITLE_ICON_SIZE} />
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setDialog({ type: 'newFolder' })}>
            <Placeholder size={SMALL_ICON_SIZE} />새 폴더
          </button>
          {/* REQ-050 폴더 멤버 모두 새 회의를 만들 수 있다 */}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => navigate(`/folders/${folderId ?? folder.folderId}/meetings/new`)}
          >
            <Placeholder size={SMALL_ICON_SIZE} />새 회의
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          {subFolders.length > 0 && (
            <section className={styles.section} aria-labelledby="sub-folders-title">
              <h2 id="sub-folders-title" className={styles.sectionTitle}>
                폴더
              </h2>
              <ul className={styles.folderRow}>
                {subFolders.map((subFolder) => (
                  <li key={subFolder.folderId}>
                    <button
                      type="button"
                      className={styles.folderCard}
                      onClick={() => navigate(`/folders/${subFolder.folderId}`)}
                    >
                      <Placeholder size={FOLDER_ICON_SIZE} />
                      <span className={styles.folderTexts}>
                        <span className={styles.folderName}>{subFolder.name}</span>
                        <span className={styles.folderMeta}>회의 {subFolder.meetingCount}개</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.section} aria-labelledby="meetings-title">
            <div className={styles.sectionHead}>
              <h2 id="meetings-title" className={styles.sectionTitle}>
                회의 목록
              </h2>
              {/* REQ-053 회의 목록 오른쪽 위 [회의록 아카이브] */}
              <button type="button" className={styles.archive} onClick={() => notice(ARCHIVE_PENDING_MESSAGE)}>
                회의록 아카이브
                <Placeholder size={SMALL_ICON_SIZE} />
              </button>
            </div>
            <MeetingTable meetings={folder.meetings} onOpen={(meeting) => navigate(meetingPath(meeting))} />
          </section>
        </div>

        <aside className={styles.side}>
          <section className={styles.section} aria-labelledby="folder-members-title">
            <h2 id="folder-members-title" className={styles.sectionTitle}>
              멤버
            </h2>
            <div className={styles.memberCard}>
              <AvatarStack members={members} label={`폴더 멤버 ${members.length}명`} />
              <button type="button" className={styles.memberManage} onClick={() => setDialog({ type: 'members' })}>
                멤버관리
                <Placeholder size={TITLE_ICON_SIZE} />
              </button>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="pending-title">
            <div className={styles.pendingHead}>
              <div>
                <h2 id="pending-title" className={styles.sectionTitle}>
                  남은 안건
                </h2>
                <p className={styles.pendingCaption}>이전 회의에서 결정하지 못한 안건이에요.</p>
              </div>
              <span className={styles.pendingCount}>{folder.pendingAgendas.length}</span>
            </div>
            <div className={styles.pendingCard}>
              {folder.pendingAgendas.length === 0 ? (
                // MSG-035
                <p className={styles.pendingEmpty}>이전 회의에서 넘어온 안건이 없습니다.</p>
              ) : (
                <ul className={styles.pendingList}>
                  {folder.pendingAgendas.map((agenda, index) => (
                    <Fragment key={agenda.pendingAgendaId}>
                      {index > 0 && (
                        <li aria-hidden="true">
                          <img
                            src={dividerPending}
                            alt=""
                            width={PENDING_DIVIDER_WIDTH}
                            height={1}
                            className={styles.divider}
                          />
                        </li>
                      )}
                      <li className={styles.pendingItem}>
                        <span className={styles.pendingTitle}>{agenda.title}</span>
                        <span className={styles.pendingMeta}>
                          {agenda.fromMeetingTitle}
                          <span className={styles.metaDivider} aria-hidden="true">
                            <img src={dividerPendingMeta} alt="" width={PENDING_META_DIVIDER_LENGTH} height={1} />
                          </span>
                          {agenda.carriedAt.replaceAll('-', '.')}
                        </span>
                      </li>
                    </Fragment>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <button type="button" className={styles.leave} onClick={() => setDialog({ type: 'leave' })}>
            이 폴더 나가기
            <Placeholder size={SMALL_ICON_SIZE} />
          </button>
        </aside>
      </div>

      {dialog?.type === 'newFolder' && (
        <FolderNameModal
          title="새 폴더"
          description="회의 성격별로 나눠 관리할 폴더를 만들어 주세요."
          submitLabel="폴더 만들기"
          siblingNames={subFolders.map(({ name }) => name)}
          onSubmit={addSubFolder}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'members' && (
        <FolderMembersModal
          members={members}
          workspaceMembers={WORKSPACE_MEMBERS}
          canManage={folder.isOwner}
          onChange={setMembers}
          onNotice={notice}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'leave' &&
        (folder.isOwner ? (
          // MSG-045
          <ConfirmDialog
            title="소유권을 양도해야 폴더에서 나갈 수 있습니다."
            message="다른 폴더 멤버에게 소유권을 양도한 후 다시 시도해 주세요."
            cancelLabel="취소"
            confirmLabel="소유권 양도"
            onCancel={closeDialog}
            onConfirm={() => setDialog({ type: 'members' })}
          />
        ) : (
          // MSG-044
          <ConfirmDialog
            title="프로젝트 폴더에서 나가시겠습니까?"
            message="나가면 이 폴더의 회의와 회의록을 더 이상 볼 수 없습니다."
            cancelLabel="취소"
            confirmLabel="나가기"
            // TODO(API 연동): 폴더 나가기 API (REQ-139, 백엔드 미구현)
            onCancel={closeDialog}
            onConfirm={() => navigate(`/workspaces/${folder.workspaceId}`, { replace: true })}
          />
        ))}
    </AppLayout>
  );
}
