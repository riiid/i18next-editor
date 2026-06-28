import {describe, expect, it} from 'vitest';
import {getLanguage} from './types';

const LANGS = ['ko', 'ja', 'en'];

describe('getLanguage', () => {
  it('정확히 일치하는 코드를 반환한다', () => {
    expect(getLanguage('ja', LANGS, 'ko')).toBe('ja');
  });

  it('지역 변형(ko-KR)을 prefix로 매칭한다', () => {
    expect(getLanguage('ko-KR', LANGS, 'en')).toBe('ko');
  });

  it('매칭이 없으면 fallback', () => {
    expect(getLanguage('fr', LANGS, 'en')).toBe('en');
  });

  it('첫 매칭을 우선한다(목록 순서)', () => {
    expect(getLanguage('en-GB', ['en', 'en-GB'], 'ko')).toBe('en');
  });
});
