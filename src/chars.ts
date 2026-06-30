/**
 * 소스에 리터럴로 박으면 git이 파일을 binary로 오인하는 "보이지 않는" 제어문자 모음.
 * fromCharCode로 정의해 여기서 import해 쓰면, 사용처 파일은 순수 ASCII로 남아
 * diff/머지/hunk 분할이 정상 동작한다(특히 NUL은 git의 binary 판정 트리거).
 */

/** NUL(U+0000). 값에 절대 나타나지 않는 안전한 join 구분자로 쓴다. */
export const NUL = String.fromCharCode(0);
