# 모아 · 전자 방명록

Next.js 14 App Router, TypeScript, Tailwind CSS로 만든 전자 방명록 UI입니다.

```powershell
npm.cmd install
npm.cmd run dev
```

터미널에 표시된 로컬 주소를 엽니다. `/`에서 사진을 첨부하거나 손그림을 등록하면 `/board`로 이동합니다. 포스트잇을 눌러 사진 또는 그림을 크게 보고 댓글을 남길 수 있습니다.

방명록과 댓글은 Supabase Postgres에, 이미지는 `moa-artwork` 버킷에 저장합니다. 기존 브라우저 미리보기의 데이터는 브라우저에 남으며 새 보드에 자동으로 올라가지 않습니다. 보드에는 최근 글 100개가 표시됩니다.

다른 환경에서 실행하려면 `.env.example`을 `.env.local`로 복사해 Supabase 프로젝트 URL과 **legacy anon 키**를 설정하세요. 이미 구성한 프로젝트에서는 이 두 값만 필요합니다. 프로젝트를 새로 구성할 때는 [SQL 마이그레이션](supabase/migrations/20261114133703_moa_guestbook.sql)을 적용하고 `supabase functions deploy moa-write --project-ref <프로젝트 참조 ID>`로 저장 함수를 배포하세요. 함수 내부에서 Supabase가 제공하는 서버 권한을 사용합니다.

서로 다른 브라우저에서 보드를 열고 한쪽에서 이미지와 댓글을 등록해 다른 쪽에 새로고침 없이 표시되는지 확인하세요. 이미지 교체를 시험하려면 관리자가 새 Storage 경로에 이미지를 올리고 `entries.image_path`를 변경하세요. 연결이 끊겼다가 돌아오면 보드와 열린 상세 창이 최신 데이터를 다시 조회합니다.

프로덕션 빌드는 `npm.cmd run build`로 확인합니다. 설계와 후속 작업은 [memory-bank](memory-bank/implementation-plan.md)에 있습니다.
