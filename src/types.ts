/**
 * 패키지 공용 타입.
 *
 * 호스트 앱의 언어 코드는 임의의 문자열(ko / ja / en / pt-BR ...)이라 string으로 둔다.
 * 지원 언어 목록(languages)은 호스트가 <I18nEditor languages={...}> 로 주입한다.
 */
export type Language = string;

/** 'translation' 네임스페이스 하나만 다룬다(i18next 기본 NS). */
export const NS = 'translation';

/** 시트 동기화 설정. 호스트가 주입할 때만 시트 UI가 켜진다. */
export type SheetsConfig = {
  /** Google OAuth Client ID (spreadsheets 스코프). */
  clientId: string;
  /** 대상 스프레드시트 ID. */
  spreadsheetId: string;
  /** 대상 탭(시트) 이름. */
  tab: string;
  /**
   * B열(0-based) 기준 각 언어의 컬럼 인덱스.
   * 기본 레이아웃 B:key C:memo D:ko E:ja F:en → {ko:2, ja:3, en:4}.
   */
  langCol: Record<Language, number>;
};

/**
 * i18next가 감지한 언어 문자열(예: 'ko-KR')을 지원 언어 코드로 정규화한다.
 * 매칭이 없으면 fallback을 반환한다.
 */
export function getLanguage(raw: string, languages: Language[], fallback: Language): Language {
  return languages.find(language => raw.startsWith(language)) ?? fallback;
}
