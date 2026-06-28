/**
 * 점(.) 구분 키 경로로 중첩 객체를 다루는 헬퍼.
 * i18next 기본 keySeparator('.')와 동일하게 동작한다.
 * (dev 도구 전용. translation.json 구조가 평면이든 중첩이든 동일하게 처리된다.)
 */

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof cur[k] !== 'object' || cur[k] == null) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}

export function deletePath(obj: Record<string, unknown>, path: string): void {
  const keys = path.split('.');
  // 경로상의 (부모, 키) 스택을 쌓으며 내려간다.
  const trail: [Record<string, unknown>, string][] = [];
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cur[keys[i]];
    if (next == null || typeof next !== 'object') return;
    trail.push([cur, keys[i]]);
    cur = next as Record<string, unknown>;
  }
  delete cur[keys[keys.length - 1]];
  // 삭제 후 비어버린 부모 객체들을 위로 거슬러 올라가며 정리(prune).
  for (let i = trail.length - 1; i >= 0; i--) {
    const [parent, key] = trail[i];
    const child = parent[key];
    if (child != null && typeof child === 'object' && Object.keys(child as object).length === 0) {
      delete parent[key];
    } else {
      break;
    }
  }
}

/**
 * 중첩 객체를 점(.) 구분 평면 맵으로 펼친다. leaf(문자열 등)만 담는다.
 * 예: {games: {foo: {name: '바'}}} → {'games.foo.name': '바'}
 */
export function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj == null) return out;
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (prefix) {
    out[prefix] = String(obj);
  }
  return out;
}

export function deepMerge<T extends Record<string, unknown>>(base: T, over: Record<string, unknown>): T {
  const out: Record<string, unknown> = {...base};
  for (const [key, value] of Object.entries(over)) {
    const prev = out[key];
    if (value != null && typeof value === 'object' && !Array.isArray(value) && prev != null && typeof prev === 'object') {
      out[key] = deepMerge(prev as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
