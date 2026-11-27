import { useState, type FormEvent } from 'react';
import { adminApi, adminErrorMessage } from '../../api/admin';
import styles from './AdminPage.module.css';

// REQ-218 관리자 빠른 작업. 표를 직접 고치지 않고 각 서비스의 내부 기능을 불러
// 비밀번호 해시, 이메일 중복 확인, 멤버 중복 같은 평소 규칙이 그대로 적용된다. 모두 감사 기록에 남는다

// user-service 비밀번호 규칙과 같다 (PasswordPolicy): 8~64자, 영문과 숫자만, 각각 1자 이상
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,64}$/;
const PASSWORD_RULE_MESSAGE = '8~64자, 영문과 숫자만 쓰고 각각 1자 이상 넣어 주세요';

type Result = { ok: boolean; text: string };

interface FormProps {
  onUnauthorized: (e: unknown) => boolean;
}

export default function AdminQuickActions({ onUnauthorized }: FormProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.tableTitle}>빠른 작업</h2>
        <span className={styles.muted}>각 서비스의 기능을 불러 처리합니다 (표를 직접 고치지 않음)</span>
      </div>
      <div className={styles.actionForms}>
        <CreateUserForm onUnauthorized={onUnauthorized} />
        <AddMemberForm onUnauthorized={onUnauthorized} />
      </div>
    </div>
  );
}

function CreateUserForm({ onUnauthorized }: FormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const passwordError = password && !PASSWORD_RULE.test(password) ? PASSWORD_RULE_MESSAGE : '';
  const canSubmit = Boolean(email.trim() && name.trim() && password) && !passwordError && !busy;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const created = await adminApi.createUser(email.trim(), password, name.trim());
      setResult({
        ok: true,
        text: `만들었습니다: ${created.email} (사용자 번호 ${created.userId}). 바로 로그인할 수 있습니다`,
      });
      setEmail('');
      setPassword('');
      setName('');
    } catch (e) {
      if (!onUnauthorized(e)) setResult({ ok: false, text: adminErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.actionForm} onSubmit={submit}>
      <h3 className={styles.sectionTitle}>시험 계정 만들기</h3>
      <p className={styles.muted}>
        이메일 인증 없이 계정을 만듭니다. 가입과 같은 규칙(이메일 중복, 비밀번호 규칙)을 따릅니다.
      </p>
      <label className={styles.field}>
        <span>이메일</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
      </label>
      <label className={styles.field}>
        <span>이름</span>
        <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span>비밀번호</span>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          aria-invalid={Boolean(passwordError)}
          required
        />
        {passwordError && <span className={styles.fieldError}>{passwordError}</span>}
      </label>
      <div className={styles.dialogButtons}>
        <button type="submit" className={styles.primary} disabled={!canSubmit}>
          {busy ? '만드는 중…' : '계정 만들기'}
        </button>
      </div>
      {result && <p className={result.ok ? styles.notice : styles.error}>{result.text}</p>}
    </form>
  );
}

function AddMemberForm({ onUnauthorized }: FormProps) {
  const [workspaceId, setWorkspaceId] = useState('');
  const [user, setUser] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const canSubmit = /^\d+$/.test(workspaceId) && Boolean(user.trim()) && !busy;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const added = await adminApi.addWorkspaceMember(Number(workspaceId), user.trim());
      setResult({
        ok: true,
        text: added.added
          ? `사용자 ${added.userId}을(를) 워크스페이스 ${added.workspaceId}의 멤버로 넣었습니다`
          : `사용자 ${added.userId}은(는) 이미 워크스페이스 ${added.workspaceId}의 멤버입니다 (바꾸지 않음)`,
      });
      setUser('');
    } catch (e) {
      if (!onUnauthorized(e)) setResult({ ok: false, text: adminErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.actionForm} onSubmit={submit}>
      <h3 className={styles.sectionTitle}>워크스페이스 멤버 넣기</h3>
      <p className={styles.muted}>초대 링크로 들어온 것과 같이 일반 멤버로 넣습니다. 이미 멤버면 바꾸지 않습니다.</p>
      <label className={styles.field}>
        <span>워크스페이스 번호</span>
        <input
          inputMode="numeric"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value.trim())}
          required
        />
      </label>
      <label className={styles.field}>
        <span>사용자 (이메일이나 사용자 번호)</span>
        <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" required />
      </label>
      <div className={styles.dialogButtons}>
        <button type="submit" className={styles.primary} disabled={!canSubmit}>
          {busy ? '넣는 중…' : '멤버로 넣기'}
        </button>
      </div>
      {result && <p className={result.ok ? styles.notice : styles.error}>{result.text}</p>}
    </form>
  );
}
