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

const SETUP_KEY = '__i18nEditorSetup';

export function setupI18nEditor(i18n: I18n, languages: Language[]): void {
  // 가드도 i18n 인스턴스에 둔다. 모듈 전역 플래그는 Fast Refresh로 리셋되면 중복 setup을 부르고,
  // 인스턴스 가드는 등록된 closure가 같은 i18n 객체를 거치므로 재등록 없이도 일관적이다.
  const host = i18n as I18n & {[SETUP_KEY]?: boolean};
  if (host[SETUP_KEY]) return;
  host[SETUP_KEY] = true;

  i18n.use({
    type: 'postProcessor',
    name: 'devKeyMarker',
    process(value: string, key: string | string[]) {
      // i18n 인스턴스를 캡처해 상태를 그 위에서 읽는다(모듈 카피가 갈라져도 동일 상태).
      return markValue(i18n, value, Array.isArray(key) ? key[0] : key);
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
