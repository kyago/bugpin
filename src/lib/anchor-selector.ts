const AUTO_ID_RE = /^:r[0-9a-z]+:?$|^[0-9]+$/;

export function isAutoId(id: string): boolean {
  return AUTO_ID_RE.test(id);
}
