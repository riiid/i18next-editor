import {describe, expect, it} from 'vitest';
import {getLanguage, matchKey} from './types';

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

  it('prefix가 겹치면 더 구체적인(긴) 코드를 우선한다', () => {
    expect(getLanguage('en-GB', ['en', 'en-GB'], 'ko')).toBe('en-GB');
    // 목록 순서와 무관(긴 코드가 먼저든 나중이든 동일).
    expect(getLanguage('en-GB', ['en-GB', 'en'], 'ko')).toBe('en-GB');
    // 정확히 짧은 코드만 맞으면 그대로 매칭.
    expect(getLanguage('en-US', ['en', 'en-GB'], 'ko')).toBe('en');
  });
});

describe('matchKey', () => {
  const ev = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

  it('Mod는 Ctrl 또는 Meta 중 하나라도 눌리면 매칭', () => {
    expect(matchKey(ev({ctrlKey: true}), 'Mod')).toBe(true);
    expect(matchKey(ev({metaKey: true}), 'Mod')).toBe(true);
    expect(matchKey(ev({}), 'Mod')).toBe(false);
  });

  it('Ctrl/Meta/Shift/Alt는 각 modifier만 본다', () => {
    expect(matchKey(ev({ctrlKey: true}), 'Ctrl')).toBe(true);
    expect(matchKey(ev({metaKey: true}), 'Ctrl')).toBe(false);
    expect(matchKey(ev({metaKey: true}), 'Meta')).toBe(true);
    expect(matchKey(ev({shiftKey: true}), 'Shift')).toBe(true);
    expect(matchKey(ev({altKey: true}), 'Alt')).toBe(true);
  });

  it('일반 키는 대소문자 무시하고 e.key와 비교한다', () => {
    expect(matchKey(ev({key: 'K'}), 'k')).toBe(true);
    expect(matchKey(ev({key: 'k'}), 'K')).toBe(true);
    expect(matchKey(ev({key: 'Escape'}), 'escape')).toBe(true);
    expect(matchKey(ev({key: 'a'}), 'b')).toBe(false);
  });
});
