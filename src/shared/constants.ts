// Body 자르기 예산
export const BODY_BUDGET = 60_000;
export const BODY_OUTER_HTML_CAP = 4_000;
export const BODY_NETWORK_FAILURES_MAX = 20;
export const BODY_CONSOLE_ERRORS_MAX = 20;
export const BODY_CONSOLE_MESSAGE_CAP = 1_000;
export const BODY_CONSOLE_STACK_CAP = 2_000;

// 버퍼 상한
export const BUFFER_MAX = 50;
export const DEDUP_PREFIX_LEN = 200;

// 슬라이더
export const LABEL_CAP = 30;
export const TEXT_FALLBACK_CAP = 12;
export const ATTR_VALUE_CAP = 5_000;

// 타임아웃 (ms)
export const TIMEOUT_BOOTSTRAP = 5_000;
export const TIMEOUT_SNAPSHOT = 5_000;
export const TIMEOUT_TOKEN_TEST = 10_000;
export const TIMEOUT_MAPPING_OP = 5_000;
export const TIMEOUT_ISSUE_SUBMIT = 30_000;

// Throttle
export const SUBMIT_THROTTLE_MS = 1_000;

// Token cache
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;

// Body indicator thresholds
export const BODY_WARN_THRESHOLD = 55_000;

// PII query-parameter names (case-insensitive)
export const PII_QUERY_KEYS = [
  'access_token', 'refresh_token', 'token',
  'api_key', 'apikey', 'auth',
  'password', 'secret', 'code',
  'bearer', 'session', 'sid', 'jwt', 'id_token',
] as const;

// postMessage 마커
export const POST_MESSAGE_SOURCE = 'qa-ext' as const;

// GitHub API
export const GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_API_VERSION = '2022-11-28';
