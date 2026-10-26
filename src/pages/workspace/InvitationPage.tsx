import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { logout } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { getMe } from '../../api/user';
import { acceptInvitation, getInvitation, type InvitationInfo } from '../../api/workspace';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import styles from './InvitationPage.module.css';

type State =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'ready'; invitation: InvitationInfo; myEmail: string };

/**
 * REQ-127 이메일 초대 수락 (초대 메일의 링크 /invitations/{token}).
 * 디자인이 없어 로그인 화면 틀에 간단히 만들었다 (docs/backlog.md)
 */
export default function InvitationPage() {
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ type: 'loading' });
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    Promise.all([getInvitation(token), getMe()])
      .then(([invitation, me]) => {
        if (isCurrent) {
          setState({ type: 'ready', invitation, myEmail: me.email });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({ type: 'error', message: errorMessage(error) });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [token]);

  const accept = async (workspaceId: number) => {
    setIsAccepting(true);
    try {
      await acceptInvitation(token);
      navigate(`/workspaces/${workspaceId}`, { replace: true });
    } catch (error) {
      setAcceptError(errorMessage(error));
      setIsAccepting(false);
    }
  };

  /** 초대받은 이메일 계정으로 다시 로그인하면 이 화면으로 돌아온다 */
  const switchAccount = async () => {
    await logout().catch(() => undefined);
    navigate('/login', { replace: true, state: { from: `/invitations/${token}` } });
  };

  return (
    <AuthLayout className={styles.page}>
      <section className={styles.card} aria-labelledby="invitation-title">
        {state.type === 'loading' && <p className={styles.caption}>초대 정보를 불러오는 중이에요.</p>}
        {state.type === 'error' && (
          <>
            <h1 id="invitation-title" className={styles.title}>
              초대를 열 수 없어요
            </h1>
            <p className={styles.caption}>{state.message}</p>
            <Button variant="neutral" onClick={() => navigate('/home', { replace: true })}>
              홈으로
            </Button>
          </>
        )}
        {state.type === 'ready' && (
          <>
            <h1 id="invitation-title" className={styles.title}>
              {state.invitation.workspaceName} 워크스페이스에 초대받았어요
            </h1>
            <p className={styles.caption}>초대받은 이메일: {state.invitation.email}</p>
            {state.invitation.member ? (
              <>
                <p className={styles.caption}>이미 참여 중인 워크스페이스예요.</p>
                <Button onClick={() => navigate(`/workspaces/${state.invitation.workspaceId}`, { replace: true })}>
                  워크스페이스로 이동
                </Button>
              </>
            ) : state.invitation.emailMatches ? (
              <>
                {acceptError && <p className={styles.error}>{acceptError}</p>}
                <Button disabled={isAccepting} onClick={() => accept(state.invitation.workspaceId)}>
                  참여하기
                </Button>
              </>
            ) : (
              <>
                <p className={styles.error}>
                  지금 로그인한 계정({state.myEmail})은 초대받은 이메일이 아니에요. 초대받은 이메일 계정으로 로그인해
                  주세요.
                </p>
                <Button onClick={switchAccount}>다른 계정으로 로그인</Button>
              </>
            )}
          </>
        )}
      </section>
    </AuthLayout>
  );
}
