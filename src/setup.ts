/**
 * i18next 배선. I18nEditor 마운트 시 1회 실행된다.
 *
 * - devKeyMarker postProcessor 등록 + 전역 postProcess에 편입(마커는 inspect 모드일 때만 실제로 붙음)
 * - base 스냅샷을 오염 전에 떠둠(initOverrideBase)
 * - localStorage에 저장된 override를 base 위에 머지
 */
import type {i18n as I18n} from 'i18next';
import {markValue} from './marker';
import {applyOverrides, initOverrideBase, loadOverrides} from './overrides';
import type {Language} from './types';

let initialized = false;

export function setupI18nEditor(i18n: I18n, languages: Language[]): void {
  if (initialized) return;
  initialized = true;

  i18n.use({
    type: 'postProcessor',
    name: 'devKeyMarker',
    process(value: string, key: string | string[]) {
      return markValue(value, Array.isArray(key) ? key[0] : key);
    },
  });

  // 전역 postProcess 목록에 마커를 편입한다(init 이후 옵션 변경이라 이후 t() 호출부터 적용).
  const current = i18n.options.postProcess;
  const list = new Set<string>(Array.isArray(current) ? current : current ? [current] : []);
  list.add('devKeyMarker');
  i18n.options.postProcess = Array.from(list);

  // override 적용 전에 base 원본을 스냅샷한다(오염 방지).
  initOverrideBase(i18n, languages);

  if (typeof window !== 'undefined') {
    applyOverrides(i18n, loadOverrides());
  }
}
