import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import { getInviteLink, joinByInviteLink, type InviteLinkInfo } from '../../api/workspace';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import JoinConfirmDialog from './JoinConfirmDialog';
import styles from './InvitationPage.module.css';

const SPINNER_SIZE = 16;

type State =
  | { type: 'loading' }
  | { type: 'error'; message: string; isExpired: boolean }
  | { type: 'ready'; invite: InviteLinkInfo };

// 만료와 잘못된 링크를 서버가 같은 코드로 돌려준다
const INVITE_LINK_INVALID = 'INVITE_LINK_INVALID';

/**
 * REQ-015 초대 링크 입장 (/invites/{token}). 2026-10-28부터 승인 없이 바로 참여한다.
 * 만료된 링크는 MSG-060 (디자인 InviteExpiredPage). 이 화면은 로그인한 뒤에 열려 [로그인 화면으로] 대신 [홈으로]를 둔다
 */
export default function InviteLinkPage() {
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ type: 'loading' });
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    getInviteLink(token)
      .then((invite) => isCurrent && setState({ type: 'ready', invite }))
      .catch(
        (error: unknown) =>
          isCurrent &&
          setState({ type: 'error', message: errorMessage(error), isExpired: isApiError(error, INVITE_LINK_INVALID) }),
      );
    return () => {
      isCurrent = false;
    };
  }, [token]);

  const goToWorkspace = (workspaceId: number) => navigate(`/workspaces/${workspaceId}`, { replace: true });

  const join = async (workspaceId: number) => {
    setIsJoining(true);
    try {
      await joinByInviteLink(token);
      goToWorkspace(workspaceId);
    } catch (error) {
      setJoinError(errorMessage(error));
      setIsJoining(false);
    }
  };

  return (
    <AuthLayout className={styles.page}>
      <section className={styles.card} aria-labelledby="invite-link-title">
        {state.type === 'loading' && (
          <p className={styles.caption}>
            <Spinner size={SPINNER_SIZE} />
            초대 정보를 불러오는 중이에요
          </p>
        )}
        {state.type === 'error' && (
          // 디자인 InviteExpiredPage
          <EmptyState
            title={state.isExpired ? '초대 링크가 만료됐어요' : '초대 링크를 열 수 없어요'}
            description={
              state.isExpired
                ? '초대 링크는 발급 후 1일 동안만 쓸 수 있어요.\n초대한 사람에게 다시 보내 달라고 요청해 주세요.'
                : state.message
            }
            action={
              <Button variant="primary" size="md" onClick={() => navigate('/home', { replace: true })}>
                홈으로
              </Button>
            }
          />
        )}
        {state.type === 'ready' && (
          <>
            <h1 id="invite-link-title" className={styles.title}>
              {state.invite.workspaceName} 워크스페이스에 초대받았어요
            </h1>
            {state.invite.isMember ? (
              <>
                <p className={styles.caption}>이미 참여 중인 워크스페이스예요.</p>
                <Button onClick={() => goToWorkspace(state.invite.workspaceId)}>워크스페이스로 이동</Button>
              </>
            ) : (
              <JoinConfirmDialog
                workspaceName={state.invite.workspaceName}
                inviterName={state.invite.inviterName}
                error={joinError}
                isBusy={isJoining}
                onReject={() => navigate('/home', { replace: true })}
                onJoin={() => join(state.invite.workspaceId)}
              />
            )}
          </>
        )}
      </section>
    </AuthLayout>
  );
}
