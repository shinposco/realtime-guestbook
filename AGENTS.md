# 프로젝트 작업 지침

이 저장소는 Next.js 14, TypeScript, Tailwind CSS, Supabase를 사용하는 실시간 전자 방명록 프로젝트다.

모든 프로젝트 작업은 이 파일과 아래 세 문서를 먼저 읽는 것부터 시작한다. 이전 대화나 기억에 의존하지 말고 현재 저장소의 문서를 확인한다.

- [memory-bank/architecture.md](memory-bank/architecture.md) — 기능 요구사항, 데이터 구조, 화면과 백엔드의 동작 기준
- [memory-bank/progress.md](memory-bank/progress.md) — 완료·미완료 항목, 실제 검증 결과, 다음 작업
- [memory-bank/implementation-plan.md](memory-bank/implementation-plan.md) — 구현 순서, 단계별 완료 기준, 검증 절차

작업을 마치기 전에 세 문서를 모두 검토하고 최신 상태로 갱신한다.

- 설계, 데이터 모델, 권한 또는 사용자 동작이 바뀌면 `architecture.md`에 반영한다.
- 구현 순서, 범위 또는 검증 계획이 바뀌면 `implementation-plan.md`에 반영한다.
- 매 작업의 변경 사항과 실제로 수행한 검증, 남은 작업을 `progress.md`에 기록한다. 실행하지 않은 검증은 미검증으로 표시한다.
- 문서 조회·갱신 규칙이 바뀌면 이 `AGENTS.md`도 함께 갱신한다. 문서끼리 내용이 어긋나면 실제 구현과 최신 결정에 맞춰 정리한다.
