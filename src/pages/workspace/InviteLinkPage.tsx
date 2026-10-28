import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { getInviteLink, joinByInviteLink, type InviteLinkInfo } from '../../api/workspace';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import styles from './InvitationPage.module.css';

type State = { type: 'loading' } | { type: 'error'; message: string } | { type: 'ready'; invite: InviteLinkInfo };

/**
 * REQ-015 초대 링크 입장 (/invites/{token}). 2026-10-28부터 승인 없이 바로 참여한다.
 * 디자인이 없어 이메일 초대 수락 화면과 같은 틀로 만들었다 (docs/backlog.md)
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
      .catch((error: unknown) => isCurrent && setState({ type: 'error', message: errorMessage(error) }));
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
        {state.type === 'loading' && <p className={styles.caption}>초대 정보를 불러오는 중이에요.</p>}
        {state.type === 'error' && (
          <>
            <h1 id="invite-link-title" className={styles.title}>
              초대 링크를 열 수 없어요
            </h1>
            <p className={styles.caption}>{state.message}</p>
            <Button variant="neutral" onClick={() => navigate('/home', { replace: true })}>
              홈으로
            </Button>
          </>
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
              <>
                {joinError && <p className={styles.error}>{joinError}</p>}
                <Button disabled={isJoining} onClick={() => join(state.invite.workspaceId)}>
                  참여하기
                </Button>
              </>
            )}
          </>
        )}
      </section>
    </AuthLayout>
  );
}
