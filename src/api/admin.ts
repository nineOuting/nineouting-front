// REQ-214~219 관리자 페이지 API (admin-service). 일반 로그인과 따로, 관리자 쿠키로 부른다
// 읽기가 아닌 요청에는 관리자 화면 머리글을 붙인다 (admin-service가 다른 사이트에서 온 요청을 막는 데 쓴다)

const BASE = '/api/admin';
const REQUEST_HEADER = { 'X-Requested-With': 'nineouting-admin' };

export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(method === 'GET' ? {} : REQUEST_HEADER),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AdminApiError('NETWORK_ERROR', '서버에 연결할 수 없습니다', 0);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AdminApiError(data?.code ?? 'ERROR', data?.message ?? `요청이 실패했습니다 (${response.status})`, response.status);
  }
  return data as T;
}

export interface AdminSession {
  username: string;
  expiresAt: string;
}

export interface AdminDatabase {
  name: string;
  database: string;
}

export interface AdminTableSummary {
  name: string;
  estimatedRows: number;
}

export interface AdminColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
  writable: boolean;
  /** REQ-219 넣을 수 있는 값이 정해진 열(enum, CHECK 제약)의 값. 정해지지 않았으면 빈 배열 */
  allowedValues: string[];
}

export interface AdminTable {
  name: string;
  columns: AdminColumn[];
  primaryKey: string[];
  readOnly: boolean;
  readOnlyReason: string | null;
}

export type AdminRow = Record<string, string | null>;

export interface AdminRowPage {
  rows: AdminRow[];
  total: number;
  page: number;
  size: number;
}

export interface AdminRowQuery {
  page: number;
  size: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  column?: string;
  q?: string;
}

/** REQ-215 현황. 시간은 한국 시간 글자 (YYYY-MM-DD HH:mm) */
export interface AdminStuckMeeting {
  id: number;
  title: string;
  workspace_id: number;
  writer_user_id: number | null;
  started_at: string;
  hours: number;
}

export type AdminFailureKind = 'draft' | 'minutesRag' | 'materialRag' | 'mail';

export interface AdminFailure {
  kind: AdminFailureKind;
  id: number;
  title: string | null;
  error: string | null;
  at: string | null;
  meeting_id?: number;
}

export interface AdminDashboard {
  counts: Partial<Record<'users' | 'usersToday' | 'workspaces' | 'meetingsToday' | 'meetingsInProgress', number>>;
  jobs: Partial<Record<'draft' | 'minutesRag' | 'materialRag' | 'mail', Record<string, number>>>;
  stuckMeetings: AdminStuckMeeting[];
  failures: AdminFailure[];
  unavailable: string[];
  stuckHours: number;
}

/** REQ-216 감사 기록 한 줄. detail은 JSON 글자 */
export interface AdminAuditEntry {
  id: number;
  occurredAt: string;
  actor: string | null;
  clientIp: string | null;
  action: string;
  target: string | null;
  succeeded: boolean;
  detail: string | null;
}

export interface AdminAuditPage {
  entries: AdminAuditEntry[];
  total: number;
  page: number;
  size: number;
  /** false면 감사 기록 DB가 없어 로그로만 남는다 */
  enabled: boolean;
}

/** 베타 테스트 개발팀 집계 (D번호 → 이름 → 개수). 개수만 온다 */
export type AdminMetricGroups = Record<string, Record<string, number>>;

export interface AdminBetaMetrics {
  query: { from: string; to: string; excludedWorkspaces: number[] };
  total: AdminMetricGroups;
  byWorkspace: Record<string, AdminMetricGroups>;
  unavailable: string[];
}

/** REQ-217 운영 조치 */
export type AdminOperation = 'meetingFinish' | 'draftRetry' | 'minutesRagRetry' | 'materialRagRetry';

const OPERATION_PATHS: Record<AdminOperation, (id: number) => string> = {
  meetingFinish: (id) => `/operations/meetings/${id}/finish`,
  draftRetry: (id) => `/operations/minutes/${id}/draft-retry`,
  minutesRagRetry: (id) => `/operations/minutes/${id}/rag-retry`,
  materialRagRetry: (id) => `/operations/materials/${id}/rag-retry`,
};

/** REQ-218 빠른 작업 결과 */
export interface AdminCreatedUser {
  userId: number;
  email: string;
  name: string;
}

export interface AdminAddedMember {
  workspaceId: number;
  userId: number;
  /** false면 이미 멤버여서 바꾸지 않았다 */
  added: boolean;
}

const tablePath = (db: string, table: string) =>
  `/databases/${encodeURIComponent(db)}/tables/${encodeURIComponent(table)}`;

export const adminApi = {
  session: () => call<AdminSession>('GET', '/session'),
  login: (username: string, password: string) => call<{ username: string }>('POST', '/session', { username, password }),
  logout: () => call<void>('DELETE', '/session'),
  databases: () => call<AdminDatabase[]>('GET', '/databases'),
  tables: (db: string) => call<AdminTableSummary[]>('GET', `/databases/${encodeURIComponent(db)}/tables`),
  table: (db: string, table: string) => call<AdminTable>('GET', tablePath(db, table)),
  /** REQ-219 짧은 글자 열에 이미 들어 있는 값 (열 이름 → 값). 추천일 뿐 다른 값도 넣을 수 있다 */
  suggestions: (db: string, table: string) => call<Record<string, string[]>>('GET', `${tablePath(db, table)}/suggestions`),
  rows: (db: string, table: string, query: AdminRowQuery) => {
    const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
    if (query.sort) params.set('sort', query.sort);
    if (query.direction) params.set('direction', query.direction);
    if (query.column) params.set('column', query.column);
    if (query.q) params.set('q', query.q);
    return call<AdminRowPage>('GET', `${tablePath(db, table)}/rows?${params}`);
  },
  insert: (db: string, table: string, values: AdminRow) => call<AdminRow>('POST', `${tablePath(db, table)}/rows`, { values }),
  update: (db: string, table: string, key: AdminRow, values: AdminRow) =>
    call<AdminRow>('PUT', `${tablePath(db, table)}/rows`, { key, values }),
  remove: (db: string, table: string, key: AdminRow) => call<AdminRow>('POST', `${tablePath(db, table)}/rows/delete`, { key }),
  dashboard: () => call<AdminDashboard>('GET', '/dashboard'),
  betaMetrics: (from: string, to: string, exclude: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (exclude.trim()) params.set('exclude', exclude.trim());
    return call<AdminBetaMetrics>('GET', `/beta-metrics?${params}`);
  },
  audit: (page: number, size: number, action?: string) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (action) params.set('action', action);
    return call<AdminAuditPage>('GET', `/audit?${params}`);
  },
  operate: (operation: AdminOperation, id: number) => call<void>('POST', OPERATION_PATHS[operation](id)),
  createUser: (email: string, password: string, name: string) =>
    call<AdminCreatedUser>('POST', '/actions/users', { email, password, name }),
  /** user는 이메일이나 사용자 번호 */
  addWorkspaceMember: (workspaceId: number, user: string) =>
    call<AdminAddedMember>('POST', '/actions/workspace-members', { workspaceId, user }),
};

export function adminErrorMessage(error: unknown) {
  return error instanceof AdminApiError ? error.message : '알 수 없는 오류가 났습니다';
}
