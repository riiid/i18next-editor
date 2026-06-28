/**
 * dev 전용 번역키 마커.
 *
 * i18next postProcessor가 t()의 반환 문자열 끝에 "보이지 않는" 마커(zero-width 문자열)를 덧붙인다.
 * 마커는 번역키를 직접 담지 않고, 런타임 레지스트리의 id를 zero-width 비트로 인코딩한다.
 * MutationObserver(아래 observer.ts)가 이 마커를 읽어 해당 텍스트의 부모 element에
 * data-i18n-key 속성을 심는다.
 *
 * - 평소엔 비활성(enabled=false)이라 t()는 순수 문자열을 반환한다.
 * - inspect 모드에 들어갈 때만 활성화하고 강제 리렌더해서, dev에서의 문자열 부작용을 최소화한다.
 * - production에선 postProcessor 자체가 등록되지 않는다(IS_DEBUG_VISIBLE 게이팅).
 */

const BIT0 = '​'; // ZERO WIDTH SPACE -> bit 0
const BIT1 = '‌'; // ZERO WIDTH NON-JOINER -> bit 1
const START = '⁠'; // WORD JOINER (zero-width) -> 마커 시작
const END = '⁣'; // INVISIBLE SEPARATOR -> 마커 끝

const keyRegistry: string[] = [];
const keyToId = new Map<string, number>();

let enabled = false;

export const isMarkerEnabled = (): boolean => enabled;
export const setMarkerEnabled = (value: boolean): void => {
  enabled = value;
};

function encodeId(id: number): string {
  const bits = id.toString(2);
  let body = '';
  for (const bit of bits) body += bit === '1' ? BIT1 : BIT0;
  return START + body + END;
}

function decodeId(marker: string): number {
  let bits = '';
  for (const ch of marker) {
    if (ch === BIT0) bits += '0';
    else if (ch === BIT1) bits += '1';
  }
  return bits.length ? parseInt(bits, 2) : -1;
}

/** postProcessor 본문: 활성화 상태일 때만 마커를 덧붙인다. */
export function markValue(value: string, key: string): string {
  if (!enabled) return value;
  let id = keyToId.get(key);
  if (id === undefined) {
    id = keyRegistry.push(key) - 1;
    keyToId.set(key, id);
  }
  return value + encodeId(id);
}

const MARKER_RE = new RegExp(`${START}[${BIT0}${BIT1}]*${END}`);

/** 텍스트에 마커가 있으면 대응하는 번역키를 돌려준다. 없으면 null. */
export function keyForMarkedText(text: string): string | null {
  const match = text.match(MARKER_RE);
  if (!match) return null;
  const id = decodeId(match[0]);
  return keyRegistry[id] ?? null;
}

export const MARKER_START = START;
