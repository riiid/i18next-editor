/**
 * 번역 override 레이어.
 *
 * 레포에 커밋된 base translation은 그대로 두고, 개발자가 도구로 수정한 값만
 * localStorage에 별도 저장한다. setup 시(dev에서만) 읽어 addResourceBundle로 머지한다.
 * override를 비우면 즉시 원본으로 복귀한다.
 *
 * base 스냅샷과 지원 언어 목록은 호스트에 묶이지 않도록, 모듈 import 시점이 아니라
 * initOverrideBase(i18n, languages)에서 런타임에 주입한다.
 */
import type {i18n as I18n} from 'i18next';
import {NS, type Language} from './types';
import {deepMerge, deletePath, flatten, getPath, setPath} from './paths';
import type {Diff} from './sheets';

const STORAGE_KEY = 'i18n-dev-overrides';

// ponytail: devtool은 싱글톤이라 모듈 전역 가변 상태로 둔다. 멀티 인스턴스가 필요해지면 클로저로 감싼다.
let languages: Language[] = [];
// i18next addResourceBundle(deep=true)는 base를 직접 mutate해 "수정한 값"을 base로 잘못 반환시킨다.
// 그러면 같은 값 재저장 시 "원본과 같다"고 판단해 override가 삭제되는 버그가 생긴다.
// 따라서 오염 전(=override 적용 전) 시점에 깊은 복사 스냅샷을 떠서 base 비교에 사용한다.
let baseSnapshot: Record<Language, Record<string, unknown>> = {};

/**
 * setup에서 1회 호출. i18n에 이미 로드된 원본 translation을 (override 적용 전에)
 * 깊은 복사로 떠둔다. 이후 getBaseValue 등 모든 base 비교는 이 스냅샷을 기준으로 한다.
 */
export function initOverrideBase(i18n: I18n, supportedLanguages: Language[]): void {
  languages = supportedLanguages;
  baseSnapshot = {};
  for (const lng of languages) {
    const data = (i18n.getDataByLanguage(lng)?.[NS] ?? {}) as Record<string, unknown>;
    baseSnapshot[lng] = structuredClone(data);
  }
}

export type Overrides = Partial<Record<Language, Record<string, unknown>>>;

export function loadOverrides(): Overrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(overrides: Overrides): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function clearOverrides(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** 어떤 언어든 실제 override 값이 하나라도 있으면 true(빈 객체는 false). */
export function hasAnyOverride(overrides: Overrides): boolean {
  return languages.some(lng => {
    const bundle = overrides[lng];
    return bundle != null && Object.keys(bundle).length > 0;
  });
}

/** override 객체 전체를 i18next 리소스에 머지해 반영한다. */
export function applyOverrides(i18n: I18n, overrides: Overrides): void {
  for (const lng of languages) {
    const bundle = overrides[lng];
    if (bundle && Object.keys(bundle).length > 0) {
      i18n.addResourceBundle(lng, NS, bundle, true, true);
    }
  }
}

/** override를 모두 버리고 i18next 리소스를 base 원본으로 되돌린다(즉시 리렌더). */
export function resetToBase(i18n: I18n): void {
  clearOverrides();
  for (const lng of languages) {
    const baseBundle = (baseSnapshot[lng] ?? {}) as Record<string, unknown>;
    // override가 base에 없는 키를 추가했을 수 있으니 번들을 통째로 갈아끼운다(deep merge로는 안 지워짐).
    i18n.removeResourceBundle(lng, NS);
    i18n.addResourceBundle(lng, NS, baseBundle, true, true);
  }
  forceRerender(i18n);
}

/** react-i18next 구독자들을 강제 리렌더(languageChanged 재발행). */
export function forceRerender(i18n: I18n): void {
  void i18n.changeLanguage(i18n.language);
}

/** 특정 키의 base(레포 원본) 값을 읽는다. (i18next에 오염되지 않은 스냅샷 기준) */
export function getBaseValue(lng: Language, key: string): string | undefined {
  const value = getPath(baseSnapshot[lng] ?? {}, key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * 현재 적용되는 값(= override가 있으면 override, 없으면 base, 둘 다 없으면 '')을 읽는다.
 * 패널 입력값(draft)을 채울 때 i18n 내부 상태(getResource) 대신 이 순수 함수를 쓴다.
 */
export function getEffectiveValue(overrides: Overrides, lng: Language, key: string): string {
  const ov = getPath(overrides[lng] ?? {}, key);
  if (typeof ov === 'string') return ov;
  return getBaseValue(lng, key) ?? '';
}

/**
 * 현재 override 전체를 key×언어 diff 목록으로 펼친다(asIs=base 원본, toBe=override 값).
 * DiffTable로 일괄 확인할 때 쓴다. base에 없던 키는 isNew=true.
 */
export function overrideDiffs(overrides: Overrides): {
  diffs: Diff[];
  currentByKey: Record<string, Record<Language, string>>;
} {
  const diffs: Diff[] = [];
  const keys = new Set<string>();
  for (const lng of languages) {
    const bundle = overrides[lng];
    if (!bundle) continue;
    for (const [key, toBe] of Object.entries(flatten(bundle))) {
      const base = getBaseValue(lng, key);
      diffs.push({key, lang: lng, asIs: base ?? '', toBe, isNew: base === undefined});
      keys.add(key);
    }
  }
  // 변경 안 된 언어 칸에 보여줄 base 값(override 없는 언어는 원본 그대로).
  const currentByKey: Record<string, Record<Language, string>> = {};
  for (const key of keys) {
    const rec = {} as Record<Language, string>;
    for (const lng of languages) rec[lng] = getBaseValue(lng, key) ?? '';
    currentByKey[key] = rec;
  }
  return {diffs, currentByKey};
}

/** 한 키의 한 언어 값을 수정해 override에 반영하고 i18next에 적용한다. */
export function setOverrideValue(i18n: I18n, overrides: Overrides, lng: Language, key: string, value: string): Overrides {
  // 중첩 객체까지 깊은 복사(setPath/deletePath가 mutate하므로 입력 overrides 불변 보장).
  const next: Overrides = {...overrides, [lng]: structuredClone(overrides[lng] ?? {})};
  const bundle = next[lng] as Record<string, unknown>;

  // base가 없는 언어(en/ja 등)는 getBaseValue가 undefined이므로 ''로 정규화해 비교한다.
  // 이렇게 해야 "빈 값"이 빈 문자열 override로 잘못 저장되지 않고 원본으로 복귀(=삭제)된다.
  if (value === (getBaseValue(lng, key) ?? '')) {
    deletePath(bundle, key);
  } else {
    setPath(bundle, key, value);
  }

  saveOverrides(next);
  // base + override를 합쳐 해당 서브트리를 다시 심는다(삭제 케이스도 base로 복귀).
  // base는 addResourceBundle(deep)에 의해 mutate되므로 오염 전 스냅샷에서 읽는다.
  const baseBundle = (baseSnapshot[lng] ?? {}) as Record<string, unknown>;
  i18n.addResourceBundle(lng, NS, deepMerge(baseBundle, bundle), true, true);
  forceRerender(i18n);
  return next;
}
