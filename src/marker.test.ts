import {describe, expect, it} from 'vitest';
import {isMarkerEnabled, keyForMarkedText, markValue, setMarkerEnabled} from './marker';

// 마커 함수는 enabled/registry를 i18n 인스턴스에 부착한다. 실제 i18next는 필요 없고,
// "상태를 달 수 있는 객체"면 충분하므로 빈 객체를 인스턴스 대용으로 쓴다.
const fakeI18n = () => ({}) as never;

describe('marker', () => {
  it('비활성 상태에선 마커를 붙이지 않는다', () => {
    const i18n = fakeI18n();
    expect(markValue(i18n, '안녕', 'greeting')).toBe('안녕');
  });

  it('활성화하면 마커를 붙이고 round-trip 디코드된다', () => {
    const i18n = fakeI18n();
    setMarkerEnabled(i18n, true);
    const marked = markValue(i18n, '안녕', 'greeting');
    expect(marked).not.toBe('안녕');
    expect(marked.startsWith('안녕')).toBe(true);
    expect(keyForMarkedText(i18n, `노드 텍스트: ${marked}`)).toBe('greeting');
  });

  it('상태는 인스턴스별로 격리된다', () => {
    const a = fakeI18n();
    const b = fakeI18n();
    setMarkerEnabled(a, true);
    expect(isMarkerEnabled(a)).toBe(true);
    expect(isMarkerEnabled(b)).toBe(false);
    expect(markValue(b, 'x', 'k')).toBe('x'); // b는 여전히 비활성
  });

  // 회귀 가드: Fast Refresh가 marker 모듈을 새 카피로 재평가해도, 등록된 closure(옛 카피)와
  // 마운트된 UI(새 카피)가 같은 i18n 객체를 거치면 상태가 갈라지지 않아야 한다.
  // 모듈 카피가 갈라져도 함수가 전부 i18n 인스턴스 상태만 읽으므로 한 인스턴스로 검증 가능하다.
  it('한 인스턴스를 거치면 enable/mark/decode가 일관된다 (HMR 분리 방지)', () => {
    const i18n = fakeI18n();
    // "UI 카피"가 활성화
    setMarkerEnabled(i18n, true);
    // "등록된 closure 카피"가 마커 부착
    const marked = markValue(i18n, '필터 적용하기', 'filter.apply');
    // "UI 카피"가 디코드
    expect(keyForMarkedText(i18n, marked)).toBe('filter.apply');
  });
});
