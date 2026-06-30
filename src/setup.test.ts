import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {i18n as I18n} from 'i18next';
import {setupI18nEditor} from './setup';

// setupI18nEditor가 건드리는 표면만 stub: use(postProcessor 등록), options.postProcess(병합),
// getDataByLanguage(initOverrideBase가 base 스냅샷할 때 읽음), addResourceBundle(applyOverrides).
function mockI18n(postProcess?: string | string[]): I18n {
  return {
    language: 'ko',
    options: {postProcess},
    use: vi.fn(),
    addResourceBundle: vi.fn(),
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    getDataByLanguage: () => ({translation: {}}),
  } as unknown as I18n;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('setupI18nEditor', () => {
  it('devKeyMarker postProcessor를 등록하고 전역 postProcess에 편입한다', () => {
    const i18n = mockI18n();
    setupI18nEditor(i18n, ['ko', 'ja', 'en']);

    expect(i18n.use).toHaveBeenCalledOnce();
    const processor = (i18n.use as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(processor.name).toBe('devKeyMarker');
    expect(i18n.options.postProcess).toEqual(['devKeyMarker']);
  });

  it('기존 postProcess를 보존하며 중복 없이 추가한다', () => {
    const arr = mockI18n(['interval', 'devKeyMarker']);
    setupI18nEditor(arr, ['ko']);
    expect(arr.options.postProcess).toEqual(['interval', 'devKeyMarker']);

    const str = mockI18n('interval');
    setupI18nEditor(str, ['ko']);
    expect(str.options.postProcess).toEqual(['interval', 'devKeyMarker']);
  });

  it('멱등: 같은 인스턴스로 두 번 호출해도 1회만 setup한다', () => {
    const i18n = mockI18n();
    setupI18nEditor(i18n, ['ko']);
    setupI18nEditor(i18n, ['ko']);
    expect(i18n.use).toHaveBeenCalledOnce();
  });
});
