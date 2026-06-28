import {describe, expect, it} from 'vitest';
import {deepMerge, deletePath, flatten, getPath, setPath} from './paths';

describe('getPath', () => {
  it('중첩 경로를 읽는다', () => {
    expect(getPath({a: {b: {c: 1}}}, 'a.b.c')).toBe(1);
  });

  it('없는 경로/비객체 중간은 undefined', () => {
    expect(getPath({a: {b: 1}}, 'a.b.c')).toBeUndefined();
    expect(getPath({a: 1}, 'a.x.y')).toBeUndefined();
    expect(getPath(null, 'a')).toBeUndefined();
  });
});

describe('setPath', () => {
  it('중간 객체를 만들어가며 값을 심는다', () => {
    const o: Record<string, unknown> = {};
    setPath(o, 'a.b.c', 'v');
    expect(o).toEqual({a: {b: {c: 'v'}}});
  });

  it('기존 형제 키를 보존한다', () => {
    const o: Record<string, unknown> = {a: {x: 1}};
    setPath(o, 'a.y', 2);
    expect(o).toEqual({a: {x: 1, y: 2}});
  });

  it('경로 중간이 비객체면 덮어쓰고 진행한다', () => {
    const o: Record<string, unknown> = {a: 5};
    setPath(o, 'a.b', 'v');
    expect(o).toEqual({a: {b: 'v'}});
  });
});

describe('deletePath', () => {
  it('값을 지운다', () => {
    const o: Record<string, unknown> = {a: {b: 1, c: 2}};
    deletePath(o, 'a.b');
    expect(o).toEqual({a: {c: 2}});
  });

  it('비어버린 부모를 위로 거슬러 prune한다', () => {
    const o: Record<string, unknown> = {a: {b: {c: 1}}};
    deletePath(o, 'a.b.c');
    expect(o).toEqual({});
  });

  it('형제가 남으면 prune하지 않는다', () => {
    const o: Record<string, unknown> = {a: {b: {c: 1}, d: 2}};
    deletePath(o, 'a.b.c');
    expect(o).toEqual({a: {d: 2}});
  });

  it('없는 경로는 무시한다', () => {
    const o: Record<string, unknown> = {a: 1};
    deletePath(o, 'x.y.z');
    expect(o).toEqual({a: 1});
  });
});

describe('flatten', () => {
  it('중첩 leaf를 점 경로 맵으로 펼친다', () => {
    expect(flatten({games: {foo: {name: '바'}}})).toEqual({'games.foo.name': '바'});
  });

  it('non-string leaf는 String으로 변환하고, null은 건너뛴다', () => {
    expect(flatten({a: 1, b: null, c: {d: true}})).toEqual({a: '1', 'c.d': 'true'});
  });

  it('빈 객체는 빈 맵', () => {
    expect(flatten({})).toEqual({});
  });
});

describe('deepMerge', () => {
  it('중첩 객체를 재귀 병합한다', () => {
    expect(deepMerge({a: {x: 1, y: 2}}, {a: {y: 3, z: 4}})).toEqual({a: {x: 1, y: 3, z: 4}});
  });

  it('배열·원시값은 통째로 교체한다', () => {
    expect(deepMerge({a: [1, 2], b: 1}, {a: [3], b: {c: 1}})).toEqual({a: [3], b: {c: 1}});
  });

  it('입력 base를 변형하지 않는다', () => {
    const base = {a: {x: 1}};
    deepMerge(base, {a: {y: 2}});
    expect(base).toEqual({a: {x: 1}});
  });
});
