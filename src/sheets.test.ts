import {describe, expect, it} from 'vitest';
import type {Language} from './types';
import {a1, computeUpsert, type Diff, groupDiffsByKey, parseSheetRows, providedLangs} from './sheets';

// 기본 레이아웃 A:key(0) B:memo(1) C:ko(2) D:ja(3) E:en(4) → row = [key, memo, ko, ja, en]
const LANGS: Language[] = ['ko', 'ja', 'en'];
const KEY_COL = 0;
const LANG_COL: Record<Language, number> = {ko: 2, ja: 3, en: 4};

describe('a1', () => {
  it('탭명을 따옴표로 감싸고 작은따옴표를 이스케이프해 URL 인코딩한다', () => {
    expect(decodeURIComponent(a1('Web(game)', 'B2:F'))).toBe("'Web(game)'!B2:F");
    expect(decodeURIComponent(a1("it's", 'B2'))).toBe("'it''s'!B2");
  });
});

describe('providedLangs', () => {
  it('실제 값이 있는 언어만 반환(빈 객체·누락 언어 제외)', () => {
    const overrides = {ko: {a: '1'}, ja: {}, en: undefined};
    expect(providedLangs(overrides, LANGS)).toEqual(['ko']);
  });
});

describe('parseSheetRows', () => {
  it('시트의 리터럴 \\n을 실제 개행으로 되돌린다', () => {
    const rows = [['k', 'm', 'a\\nb', '', '']];
    expect(parseSheetRows(rows, LANGS, KEY_COL, LANG_COL)).toEqual([{key: 'k', lang: 'ko', value: 'a\nb'}]);
  });

  it('값 있는 셀만 (key, lang, value)로 펼친다', () => {
    const rows = [
      ['greeting', 'memo', '안녕', 'こんにちは', 'hi'],
      ['empty.en', 'm', '', '', 'only-en'],
    ];
    expect(parseSheetRows(rows, LANGS, KEY_COL, LANG_COL)).toEqual([
      {key: 'greeting', lang: 'ko', value: '안녕'},
      {key: 'greeting', lang: 'ja', value: 'こんにちは'},
      {key: 'greeting', lang: 'en', value: 'hi'},
      {key: 'empty.en', lang: 'en', value: 'only-en'},
    ]);
  });

  it('key 빈 행과 누락 셀(undefined)은 건너뛴다', () => {
    const rows = [
      ['', 'm', '버려짐'],
      ['k', 'm'], // 언어 셀 모두 누락
    ];
    expect(parseSheetRows(rows, LANGS, KEY_COL, LANG_COL)).toEqual([]);
  });
});

describe('computeUpsert', () => {
  it('기존 행은 셀만 교체하고, 같은 값은 변경하지 않는다', () => {
    const existing = [['greeting', 'memo', '안녕', 'こ', 'hi']];
    const overrides = {ko: {greeting: '반가워'}, en: {greeting: 'hi'}}; // ko만 실제 변경
    const {values, diffs} = computeUpsert(existing, overrides, LANGS, KEY_COL, LANG_COL);
    expect(values[0]).toEqual(['greeting', 'memo', '반가워', 'こ', 'hi']);
    expect(diffs).toEqual([{key: 'greeting', lang: 'ko', asIs: '안녕', toBe: '반가워', isNew: false}]);
  });

  it('없는 key는 행을 추가하고 isNew=true', () => {
    const {values, diffs} = computeUpsert([], {ko: {brandnew: '새값'}}, LANGS, KEY_COL, LANG_COL);
    expect(values).toEqual([['brandnew', '', '새값', '', '']]);
    expect(diffs).toEqual([{key: 'brandnew', lang: 'ko', asIs: '', toBe: '새값', isNew: true}]);
  });

  it('trailing 빈 셀이 생략된 기존 행을 cols 길이로 패딩한다', () => {
    const existing = [['k']]; // ko/ja/en 셀이 생략된 행
    const {values} = computeUpsert(existing, {ja: {k: 'やあ'}}, LANGS, KEY_COL, LANG_COL);
    expect(values[0]).toEqual(['k', '', '', 'やあ', '']);
  });

  it('currentByKey: 변경된 key의 모든 언어 기존값을 스냅샷한다', () => {
    const existing = [['greeting', 'm', '안녕', 'こ', 'hi']];
    const {currentByKey} = computeUpsert(existing, {ko: {greeting: '반가워'}}, LANGS, KEY_COL, LANG_COL);
    expect(currentByKey.greeting).toEqual({ko: '안녕', ja: 'こ', en: 'hi'});
  });

  it('A열·memo·다른 언어·행 순서를 보존한다', () => {
    const existing = [
      ['a', 'memoA', 'ko-a', 'ja-a', 'en-a'],
      ['b', 'memoB', 'ko-b', 'ja-b', 'en-b'],
    ];
    const {values} = computeUpsert(existing, {en: {b: 'en-b-new'}}, LANGS, KEY_COL, LANG_COL);
    expect(values[0]).toEqual(['a', 'memoA', 'ko-a', 'ja-a', 'en-a']);
    expect(values[1]).toEqual(['b', 'memoB', 'ko-b', 'ja-b', 'en-b-new']);
  });
});

describe('groupDiffsByKey', () => {
  it('key별로 묶고 첫 등장 순서를 유지한다', () => {
    const diffs: Diff[] = [
      {key: 'b', lang: 'ko', asIs: '', toBe: '1', isNew: true},
      {key: 'a', lang: 'ko', asIs: '', toBe: '2', isNew: true},
      {key: 'b', lang: 'en', asIs: '', toBe: '3', isNew: true},
    ];
    const grouped = groupDiffsByKey(diffs);
    expect(grouped.map(([k]) => k)).toEqual(['b', 'a']);
    expect(grouped[0][1]).toEqual({ko: diffs[0], en: diffs[2]});
  });
});
