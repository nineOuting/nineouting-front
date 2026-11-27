import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  adminApi,
  adminErrorMessage,
  type AdminColumn,
  type AdminDatabase,
  type AdminRow,
  type AdminRowPage,
  type AdminTable,
  type AdminTableSummary,
} from '../../api/admin';
import AdminAudit from './AdminAudit';
import AdminDashboard from './AdminDashboard';
import styles from './AdminPage.module.css';

// REQ-214~217 관리자 페이지 (admin-service). 일반 사용자 로그인과 따로 관리자 계정으로 들어온다
// 현황(REQ-215, 운영 조치 REQ-217), DB 표 보기와 한 행씩 추가, 수정, 삭제(REQ-214), 감사 기록(REQ-216)

const PAGE_SIZES = [20, 50, 100, 200];
const message = adminErrorMessage;

type Tab = 'dashboard' | 'db' | 'audit';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: '현황' },
  { id: 'db', label: 'DB' },
  { id: 'audit', label: '감사 기록' },
];

export default function AdminPage() {
  const [state, setState] = useState<'checking' | 'guest' | 'in'>('checking');
  const [username, setUsername] = useState('');

  useEffect(() => {
    document.title = '넵넵 관리자';
    adminApi
      .session()
      .then((session) => {
        setUsername(session.username);
        setState('in');
      })
      .catch(() => setState('guest'));
  }, []);

  if (state === 'checking') {
    return <div className={styles.center}>확인하는 중…</div>;
  }
  if (state === 'guest') {
    return (
      <LoginForm
        onLoggedIn={(name) => {
          setUsername(name);
          setState('in');
        }}
      />
    );
  }
  return (
    <AdminShell
      username={username}
      onLoggedOut={() => {
        setUsername('');
        setState('guest');
      }}
    />
  );
}

/** 로그인한 뒤의 틀: 위쪽 탭과 로그아웃. 로그인이 끊기면(401) 로그인 화면으로 */
function AdminShell({ username, onLoggedOut }: { username: string; onLoggedOut: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');

  const onUnauthorized = useCallback(
    (e: unknown) => {
      if (e instanceof AdminApiError && e.status === 401) {
        onLoggedOut();
        return true;
      }
      return false;
    },
    [onLoggedOut],
  );

  const logout = async () => {
    await adminApi.logout().catch(() => undefined);
    onLoggedOut();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <strong>넵넵 관리자</strong>
        <nav className={styles.tabs} aria-label="관리자 메뉴">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === tab ? styles.tabActive : styles.tab}
              aria-current={t.id === tab ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {tab === 'db' && <span className={styles.warning}>DEV DB를 바로 고칩니다. 바꾼 내용은 되돌릴 수 없습니다</span>}
        <span className={styles.spacer} />
        <span className={styles.muted}>{username}</span>
        <button type="button" className={styles.secondary} onClick={logout}>
          로그아웃
        </button>
      </header>
      {tab === 'dashboard' && <AdminDashboard onUnauthorized={onUnauthorized} />}
      {tab === 'db' && <Explorer onUnauthorized={onUnauthorized} />}
      {tab === 'audit' && <AdminAudit onUnauthorized={onUnauthorized} />}
    </div>
  );
}

function LoginForm({ onLoggedIn }: { onLoggedIn: (username: string) => void }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await adminApi.login(id, password);
      onLoggedIn(result.username);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.center}>
      <form className={styles.loginCard} onSubmit={submit}>
        <h1 className={styles.loginTitle}>넵넵 관리자</h1>
        <label className={styles.field}>
          <span>아이디</span>
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className={styles.field}>
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.primary} disabled={busy || !id || !password}>
          {busy ? '로그인하는 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}

interface Query {
  page: number;
  size: number;
  sort?: string;
  direction: 'asc' | 'desc';
  column: string;
  q: string;
}

const EMPTY_QUERY: Query = { page: 0, size: 50, direction: 'asc', column: '', q: '' };

function Explorer({ onUnauthorized }: { onUnauthorized: (e: unknown) => boolean }) {
  const [databases, setDatabases] = useState<AdminDatabase[]>([]);
  const [db, setDb] = useState('');
  const [tables, setTables] = useState<AdminTableSummary[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [tableName, setTableName] = useState('');
  const [table, setTable] = useState<AdminTable | null>(null);
  const [query, setQuery] = useState<Query>(EMPTY_QUERY);
  const [search, setSearch] = useState({ column: '', q: '' });
  const [page, setPage] = useState<AdminRowPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<{ mode: 'insert' } | { mode: 'edit'; row: AdminRow } | null>(null);

  const handleError = useCallback(
    (e: unknown) => {
      if (!onUnauthorized(e)) setError(message(e));
    },
    [onUnauthorized],
  );

  useEffect(() => {
    adminApi
      .databases()
      .then((list) => {
        setDatabases(list);
        if (list.length > 0) setDb(list[0].name);
      })
      .catch(handleError);
  }, [handleError]);

  useEffect(() => {
    if (!db) return;
    adminApi.tables(db).then(setTables).catch(handleError);
  }, [db, handleError]);

  useEffect(() => {
    if (!db || !tableName) return;
    adminApi.table(db, tableName).then(setTable).catch(handleError);
  }, [db, tableName, handleError]);

  /** DB나 표를 바꾸면 보던 내용을 비운다 */
  const chooseDb = (name: string) => {
    setDb(name);
    setTables([]);
    chooseTable('');
  };

  const chooseTable = (name: string) => {
    setTableName(name);
    setTable(null);
    setPage(null);
    setQuery(EMPTY_QUERY);
    setSearch({ column: '', q: '' });
    setNotice('');
    setError('');
  };

  const loadRows = useCallback(async () => {
    if (!db || !table) return;
    setLoading(true);
    setError('');
    try {
      setPage(
        await adminApi.rows(db, table.name, {
          page: query.page,
          size: query.size,
          sort: query.sort,
          direction: query.direction,
          column: query.column || undefined,
          q: query.q || undefined,
        }),
      );
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [db, table, query, handleError]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const visibleTables = useMemo(
    () => tables.filter((t) => t.name.toLowerCase().includes(tableFilter.toLowerCase())),
    [tables, tableFilter],
  );
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.size)) : 1;

  const keyOf = (row: AdminRow) => Object.fromEntries((table?.primaryKey ?? []).map((name) => [name, row[name]]));

  const sortBy = (column: string) =>
    setQuery((q) => ({
      ...q,
      page: 0,
      sort: column,
      direction: q.sort === column && q.direction === 'asc' ? 'desc' : 'asc',
    }));

  const remove = async (row: AdminRow) => {
    if (!table) return;
    const key = keyOf(row);
    const label = Object.entries(key)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    if (!window.confirm(`${table.name} 표에서 이 행(${label})을 지울까요? 되돌릴 수 없습니다.`)) return;
    try {
      await adminApi.remove(db, table.name, key);
      setNotice(`지웠습니다 (${label})`);
      await loadRows();
    } catch (e) {
      handleError(e);
    }
  };

  return (
    <>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <label className={styles.field}>
            <span>DB</span>
            <select value={db} onChange={(e) => chooseDb(e.target.value)}>
              {databases.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.database})
                </option>
              ))}
            </select>
          </label>
          <input
            className={styles.tableFilter}
            placeholder="표 이름 찾기"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
          />
          <ul className={styles.tableList}>
            {visibleTables.map((t) => (
              <li key={t.name}>
                <button
                  type="button"
                  className={t.name === tableName ? styles.tableSelected : styles.tableItem}
                  onClick={() => chooseTable(t.name)}
                >
                  <span>{t.name}</span>
                  <span className={styles.muted}>~{t.estimatedRows.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className={styles.main}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {notice && !error && <p className={styles.notice}>{notice}</p>}
          {!table && <p className={styles.muted}>왼쪽에서 표를 고르세요.</p>}
          {table && (
            <>
              <div className={styles.toolbar}>
                <h2 className={styles.tableTitle}>{table.name}</h2>
                {table.readOnly && <span className={styles.badge}>읽기만: {table.readOnlyReason}</span>}
                <span className={styles.spacer} />
                <form
                  className={styles.search}
                  onSubmit={(e) => {
                    e.preventDefault();
                    setQuery((q) => ({ ...q, page: 0, column: search.column, q: search.q }));
                  }}
                >
                  <select value={search.column} onChange={(e) => setSearch((s) => ({ ...s, column: e.target.value }))}>
                    <option value="">모든 열</option>
                    {table.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="찾을 값 (일부만 써도 됨)"
                    value={search.q}
                    onChange={(e) => setSearch((s) => ({ ...s, q: e.target.value }))}
                  />
                  <button type="submit" className={styles.secondary}>
                    찾기
                  </button>
                </form>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={table.readOnly}
                  onClick={() => {
                    setNotice('');
                    setEditing({ mode: 'insert' });
                  }}
                >
                  행 추가
                </button>
              </div>
              <div className={styles.gridWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      {!table.readOnly && <th className={styles.actionsHead} />}
                      {table.columns.map((c) => (
                        <th key={c.name}>
                          <button type="button" className={styles.sortButton} onClick={() => sortBy(c.name)}>
                            {c.primaryKey && <span className={styles.pk}>PK</span>}
                            {c.name}
                            {query.sort === c.name && (query.direction === 'asc' ? ' ▲' : ' ▼')}
                          </button>
                          <div className={styles.columnType}>{c.type}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {page?.rows.map((row, index) => (
                      <tr key={`${index}-${JSON.stringify(keyOf(row))}`}>
                        {!table.readOnly && (
                          <td className={styles.actions}>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => {
                                setNotice('');
                                setEditing({ mode: 'edit', row });
                              }}
                            >
                              수정
                            </button>
                            <button type="button" className={styles.dangerLink} onClick={() => remove(row)}>
                              삭제
                            </button>
                          </td>
                        )}
                        {table.columns.map((c) => (
                          <td key={c.name} title={row[c.name] ?? 'NULL'}>
                            {row[c.name] === null ? <span className={styles.null}>NULL</span> : row[c.name]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {page && page.rows.length === 0 && <p className={styles.muted}>행이 없습니다.</p>}
              </div>
              <div className={styles.pager}>
                <span className={styles.muted}>
                  {loading ? '불러오는 중…' : `전체 ${page?.total.toLocaleString() ?? 0}행`}
                </span>
                <span className={styles.spacer} />
                <select
                  value={query.size}
                  onChange={(e) => setQuery((q) => ({ ...q, page: 0, size: Number(e.target.value) }))}
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}행씩
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={query.page === 0}
                  onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
                >
                  이전
                </button>
                <span>
                  {query.page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={query.page + 1 >= totalPages}
                  onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
                >
                  다음
                </button>
              </div>
            </>
          )}
        </main>
      </div>
      {editing && table && (
        <RowEditor
          table={table}
          row={editing.mode === 'edit' ? editing.row : null}
          onCancel={() => setEditing(null)}
          onSave={async (values) => {
            if (editing.mode === 'edit') {
              await adminApi.update(db, table.name, keyOf(editing.row), values);
              setNotice('고쳤습니다');
            } else {
              await adminApi.insert(db, table.name, values);
              setNotice('추가했습니다');
            }
            setEditing(null);
            await loadRows();
          }}
        />
      )}
    </>
  );
}

interface FieldState {
  value: string;
  isNull: boolean;
  touched: boolean;
}

/** 행 추가, 수정 창. 수정은 바꾼 열만, 추가는 손댄 열만 보낸다 (손대지 않은 열은 DB 기본값) */
function RowEditor({
  table,
  row,
  onCancel,
  onSave,
}: {
  table: AdminTable;
  row: AdminRow | null;
  onCancel: () => void;
  onSave: (values: AdminRow) => Promise<void>;
}) {
  const [fields, setFields] = useState<Record<string, FieldState>>(() =>
    Object.fromEntries(
      table.columns.map((c) => [
        c.name,
        { value: row?.[c.name] ?? '', isNull: row ? row[c.name] === null : false, touched: false },
      ]),
    ),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const editable = (c: AdminColumn) => c.writable && !(row && c.primaryKey);

  const change = (name: string, patch: Partial<FieldState>) =>
    setFields((f) => ({ ...f, [name]: { ...f[name], ...patch, touched: true } }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const values: AdminRow = {};
    table.columns.filter(editable).forEach((c) => {
      const field = fields[c.name];
      const next = field.isNull ? null : field.value;
      if (row ? next !== row[c.name] : field.touched) {
        values[c.name] = next;
      }
    });
    if (row && Object.keys(values).length === 0) {
      setError('바꾼 값이 없습니다');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(values);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <form className={styles.dialog} onSubmit={submit}>
        <h2 className={styles.tableTitle}>
          {table.name} {row ? '행 수정' : '행 추가'}
        </h2>
        {!row && <p className={styles.muted}>비워 둔 열은 DB 기본값으로 들어갑니다.</p>}
        <div className={styles.fields}>
          {table.columns.map((c) => {
            const field = fields[c.name];
            const disabled = !editable(c);
            const long = /json|text|\[\]/.test(c.type);
            return (
              <label key={c.name} className={styles.field}>
                <span>
                  {c.primaryKey && <span className={styles.pk}>PK</span>}
                  {c.name} <span className={styles.columnType}>{c.type}</span>
                  {!c.nullable && <span className={styles.required}> 필수</span>}
                  {disabled && <span className={styles.muted}> (고칠 수 없음)</span>}
                </span>
                {long ? (
                  <textarea
                    rows={3}
                    value={field.value}
                    disabled={disabled || field.isNull}
                    placeholder={!row && c.defaultValue ? `기본값: ${c.defaultValue}` : ''}
                    onChange={(e) => change(c.name, { value: e.target.value })}
                  />
                ) : (
                  <input
                    value={field.value}
                    disabled={disabled || field.isNull}
                    placeholder={!row && c.defaultValue ? `기본값: ${c.defaultValue}` : ''}
                    onChange={(e) => change(c.name, { value: e.target.value })}
                  />
                )}
                {c.nullable && !disabled && (
                  <span className={styles.nullToggle}>
                    <input
                      type="checkbox"
                      checked={field.isNull}
                      onChange={(e) => change(c.name, { isNull: e.target.checked })}
                    />
                    NULL
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.dialogButtons}>
          <button type="button" className={styles.secondary} onClick={onCancel}>
            닫기
          </button>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? '저장하는 중…' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
