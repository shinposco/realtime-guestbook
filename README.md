# 모아 · 전자 방명록

Next.js 14 App Router, TypeScript, Tailwind CSS로 만든 전자 방명록 UI입니다.

```powershell
npm.cmd install
npm.cmd run dev
```

터미널에 표시된 로컬 주소를 엽니다. `/board`에서 누구나 포스트잇과 댓글을 볼 수 있습니다. 이메일 인증을 마치고 로그인하면 `/`에서 사진이나 손그림을 올리고 포스트잇에 댓글을 남길 수 있습니다.

방명록과 댓글은 Supabase Postgres에, 이미지는 `moa-artwork` 버킷에 저장합니다. 기존 브라우저 미리보기의 데이터는 브라우저에 남으며 새 보드에 자동으로 올라가지 않습니다. 보드에는 최근 글 100개가 표시됩니다.

## Supabase 설정

- `.env.example`을 `.env.local`로 복사해 Supabase 프로젝트 URL과 공개 **legacy anon 키**를 설정합니다. 서버 쓰기 키는 Edge Function 환경에서 사용합니다.
- 호스팅 프로젝트의 Authentication에서 Email 공급자와 가입 이메일 확인을 켜고, 앱 주소를 Site URL로 설정합니다. 각 환경에서 실제로 사용할 `http://localhost:3000/auth/confirm` 또는 `https://<앱 주소>/auth/confirm`을 Redirect URLs에 추가합니다. 로컬 Supabase 스택은 `supabase/config.toml`의 설정을 사용합니다.
- Supabase 기본 가입·재설정 메일과 [가입 확인 템플릿](supabase/templates/confirmation.html), [재설정 템플릿](supabase/templates/recovery.html)을 모두 사용할 수 있습니다. 실제 메일을 열어 링크가 앱에 도착하는지 확인합니다. 인증 후 원래 작성 화면에서 로그인합니다. [Supabase 이메일 템플릿](https://supabase.com/docs/guides/auth/auth-email-templates)
- 가입을 마친 계정은 같은 주소로 다시 가입해도 기존 비밀번호가 바뀌지 않습니다. 로그인 화면의 **비밀번호 재설정**을 사용합니다. 미인증 계정의 메일이 만료됐다면 **가입 확인 메일 재발송**을 사용합니다. 팀 외 주소로 인증 메일을 발송하려면 호스팅 프로젝트에 커스텀 SMTP를 설정합니다. [Supabase 메일 발송 설정](https://supabase.com/docs/guides/auth/auth-smtp)

### 배포 순서

새 프로젝트는 [`supabase/migrations`](supabase/migrations)의 SQL을 시간순으로 적용한 뒤 `supabase functions deploy moa-write --project-ref <프로젝트 참조 ID>`로 함수를 배포합니다.

이미 운영 중인 프로젝트에서는 먼저 DB 복구 지점과 `moa-artwork` 파일 백업을 준비합니다.

1. [작성자 연결 마이그레이션](supabase/migrations/20261115090000_guestbook_ownership.sql)을 적용하고 공개 조회와 기존 등록이 동작하는지 확인합니다.
2. `moa-write`를 배포해 사용자 토큰 검증을 시작합니다. 이전 버전의 등록 요청이 끝날 때까지 기다린 뒤 [직접 INSERT 권한 회수](supabase/migrations/20261115090100_require_guestbook_registration_rpc.sql)를 적용합니다. 운영 DB에 두 마이그레이션을 한 번에 적용하면 함수 교체 전 등록이 중단됩니다. SQL Editor에서 파일을 실행한 경우 적용 여부를 확인한 뒤 Supabase 마이그레이션 이력에도 각각 기록합니다.
3. 새 앱을 배포하고 공개 키만 사용한 요청의 거부, 인증 회원의 글·댓글 등록, 기존 이미지와 댓글 조회를 확인합니다. 이전 버전의 탭에서는 새로고침 후 로그인합니다. 전환과 복구 상세 절차는 [구현 계획](memory-bank/implementation-plan.md#63-운영-전환과-복구)에 있습니다.

서로 다른 브라우저에서 보드를 열고 한쪽에서 이미지와 댓글을 등록해 다른 쪽에 새로고침 없이 표시되는지 확인하세요. 이미지 교체를 시험하려면 관리자가 새 Storage 경로에 이미지를 올리고 `entries.image_path`를 변경하세요. 연결이 끊겼다가 돌아오면 보드와 열린 상세 창이 최신 데이터를 다시 조회합니다.

프로덕션 빌드는 `npm.cmd run build`로 확인합니다. 설계와 후속 작업은 [memory-bank](memory-bank/implementation-plan.md)에 있습니다.
