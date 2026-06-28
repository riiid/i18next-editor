import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {i18n as I18n} from 'i18next';
import {getPath} from './paths';
import {
  clearOverrides,
  getBaseValue,
  getEffectiveValue,
  hasAnyOverride,
  initOverrideBase,
  loadOverrides,
  type Overrides,
  saveOverrides,
  setOverrideValue,
} from './overrides';

const KEY = 'games.type-type.description';
const KO_BASE = '타입-타입 게임 설명';

// base fixture: ko는 값이 있고(authoring 언어), ja/en은 비어있다.
// getDataByLanguage가 이 객체를 반환하고, initOverrideBase가 깊은 복사로 스냅샷한다.
let BASE: Record<string, Record<string, unknown>>;

// setOverrideValue가 호출하는 i18n 메서드 + initOverrideBase가 읽는 getDataByLanguage를 stub.
function mockI18n(): I18n {
  return {
    language: 'ko',
    addResourceBundle: vi.fn(),
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    getDataByLanguage: (lng: string) => ({translation: BASE[lng] ?? {}}),
  } as unknown as I18n;
}

beforeEach(() => {
  window.localStorage.clear();
  BASE = {ko: {games: {'type-type': {description: KO_BASE}}}, ja: {}, en: {}};
  initOverrideBase(mockI18n(), ['ko', 'ja', 'en']);
});

describe('load/save/clear', () => {
  it('save → load 라운드트립', () => {
    const data: Overrides = {ko: {games: {'type-type': {description: 'x'}}}};
    saveOverrides(data);
    expect(loadOverrides()).toEqual(data);
  });

  it('clear 후 빈 객체', () => {
    saveOverrides({ko: {a: '1'}});
    clearOverrides();
    expect(loadOverrides()).toEqual({});
  });
});

describe('setOverrideValue', () => {
  it('base와 다른 값은 override로 저장된다', () => {
    setOverrideValue(mockI18n(), {}, 'ko', KEY, '바뀐 값');
    expect(getPath(loadOverrides().ko, KEY)).toBe('바뀐 값');
  });

  it('base와 같은 값이면 override를 만들지 않는다(원복)', () => {
    setOverrideValue(mockI18n(), {}, 'ko', KEY, KO_BASE);
    expect(getPath(loadOverrides().ko, KEY)).toBeUndefined();
  });

  // 사용자 재현 핵심: en은 base가 undefined라 빈 값 비교가 깨진다.
  it('base 없는 언어(en)에 빈 값을 저장하면 override를 만들지 않아야 한다', () => {
    setOverrideValue(mockI18n(), {}, 'en', KEY, '');
    expect(getPath(loadOverrides().en, KEY)).toBeUndefined();
  });

  it('재현: en "asdf"를 같은 값으로 다시 저장해도 유지된다', () => {
    const i18n = mockI18n();
    const start = setOverrideValue(i18n, {}, 'en', KEY, 'asdf');
    expect(getPath(loadOverrides().en, KEY)).toBe('asdf');
    setOverrideValue(i18n, start, 'en', KEY, 'asdf');
    expect(getPath(loadOverrides().en, KEY)).toBe('asdf');
  });

  it('재현: en "asdf"인데 빈 값으로 저장하면 빈 문자열로 남지 않고 제거된다', () => {
    const i18n = mockI18n();
    const start = setOverrideValue(i18n, {}, 'en', KEY, 'asdf');
    setOverrideValue(i18n, start, 'en', KEY, '');
    expect(getPath(loadOverrides().en, KEY)).toBeUndefined();
  });

  it('immutability: 입력 overrides 객체를 변형하지 않는다', () => {
    const original: Overrides = {en: {games: {'type-type': {description: 'asdf'}}}};
    const snapshot = structuredClone(original);
    setOverrideValue(mockI18n(), original, 'en', 'games.type-type.name', '새이름');
    expect(original).toEqual(snapshot);
  });

  it('같은 게임 하위 다른 키를 추가해도 기존 키가 보존된다', () => {
    const i18n = mockI18n();
    let acc = setOverrideValue(i18n, {}, 'en', 'games.type-type.name', 'N');
    acc = setOverrideValue(i18n, acc, 'en', 'games.type-type.description', 'D');
    expect(loadOverrides().en).toEqual({games: {'type-type': {name: 'N', description: 'D'}}});
  });

  it('override 삭제 후 빈 부모 객체를 남기지 않는다(prune)', () => {
    const i18n = mockI18n();
    let acc = setOverrideValue(i18n, {}, 'ko', KEY, '임시');
    acc = setOverrideValue(i18n, acc, 'ko', KEY, KO_BASE); // base와 같아짐 → 삭제
    expect(loadOverrides().ko).toEqual({});
  });

  it('hasAnyOverride: 실제 값이 있을 때만 true(빈 객체는 false)', () => {
    expect(hasAnyOverride({})).toBe(false);
    expect(hasAnyOverride({en: {}})).toBe(false);
    expect(hasAnyOverride({en: {games: {'type-type': {description: 'a'}}}})).toBe(true);
  });

  it('getEffectiveValue: override > base > 빈문자열 순으로 읽는다', () => {
    // override 있으면 그 값
    expect(getEffectiveValue({en: {games: {'type-type': {description: 'asdf'}}}}, 'en', KEY)).toBe('asdf');
    // override 없으면 base (ko)
    expect(getEffectiveValue({}, 'ko', KEY)).toBe(KO_BASE);
    // 둘 다 없으면 '' (en은 base 비어있음)
    expect(getEffectiveValue({}, 'en', KEY)).toBe('');
  });

  // 사용자 재현: en에 'aaaa' 저장 후 같은 값으로 또 저장하면 사라지던 버그.
  // 원인은 i18next addResourceBundle(deep)가 base를 mutate해 base 비교가 오염되는 것.
  // 패키지는 initOverrideBase 시점 스냅샷을 기준으로 하므로, 이후 store가 오염돼도 안전해야 한다.
  it('회귀: 스냅샷 이후 i18n store가 오염돼도 getBaseValue/재저장은 스냅샷 기준이라 안 사라진다', () => {
    const KEY2 = 'games.type-type.tagline'; // base에 없는 키
    expect(getBaseValue('en', KEY2)).toBeUndefined();
    // addResourceBundle(deep)가 store를 오염시키는 상황을 모사(스냅샷 이후라 영향 없어야 함).
    BASE.en = {games: {'type-type': {tagline: 'aaaa'}}};
    expect(getBaseValue('en', KEY2)).toBeUndefined();

    const i18n = mockI18n();
    let acc = setOverrideValue(i18n, {}, 'en', KEY2, 'aaaa'); // 1차 저장
    expect(getPath(loadOverrides().en, KEY2)).toBe('aaaa');
    acc = setOverrideValue(i18n, acc, 'en', KEY2, 'aaaa'); // 2차 저장(동일 값)
    expect(getPath(loadOverrides().en, KEY2)).toBe('aaaa'); // 사라지지 않아야 함
  });

  // 사용자 재현: base 키를 A→B로 바꾼 뒤 다시 A(원본)로 되돌리면 UI에 반영 안 됨.
  // 원인: addResourceBundle(deep)가 base를 B로 오염시켜, revert 재머지가 base 대신 B를 다시 심음.
  // 패키지는 스냅샷 기준이라 마지막에 원본 A가 심겨야 한다.
  it('회귀: base 키를 B로 바꿨다가 A(원본)로 되돌리면 addResourceBundle에 base값(A)이 다시 심긴다', () => {
    let lastMerged: Record<string, unknown> | undefined;
    const i18n = {
      language: 'ko',
      addResourceBundle: vi.fn((_lng, _ns, bundle: Record<string, unknown>) => {
        lastMerged = bundle;
      }),
      changeLanguage: vi.fn().mockResolvedValue(undefined),
      getDataByLanguage: (lng: string) => ({translation: BASE[lng] ?? {}}),
    } as unknown as I18n;

    let acc = setOverrideValue(i18n, {}, 'ko', KEY, '바뀐값B'); // A→B
    acc = setOverrideValue(i18n, acc, 'ko', KEY, KO_BASE); // B→A(원본)
    // 마지막으로 i18next에 심긴 값이 원본 A여야 UI에 반영된다(오염된 B가 아님)
    expect(getPath(lastMerged, KEY)).toBe(KO_BASE);
  });

  it('사용자 시나리오: en만 override된 상태에서 전 언어 save 시 en 값 유지 + ja/ko에 쓰레기 없음', () => {
    const i18n = mockI18n();
    const overrides: Overrides = {en: {games: {'type-type': {description: 'asdf'}}}};
    const draft: Record<string, string> = {ko: KO_BASE, ja: '', en: 'asdf'};
    let acc = overrides;
    for (const lng of ['ko', 'ja', 'en'] as const) {
      acc = setOverrideValue(i18n, acc, lng, KEY, draft[lng]);
    }
    const saved = loadOverrides();
    expect(getPath(saved.en, KEY)).toBe('asdf'); // en 유지
    expect(getPath(saved.ja, KEY)).toBeUndefined(); // ja 빈 문자열 쓰레기 없음
    expect(getPath(saved.ko, KEY)).toBeUndefined(); // ko 원복
  });
});
