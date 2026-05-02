# 업로드 안내

이 폴더 전체를 배포용으로 준비해 두었습니다.

폴더 위치:

`C:\Users\user\Documents\@CODEX\음료주문앱\deploy-upload-render`

## 어디에 올리면 되나요?

현재 이 앱은 주문 저장과 관리자 기능이 있어서 **정적 사이트 업로드만으로는 동작하지 않습니다.**

그래서 아래 3개 중에서는 이렇게 판단하시면 됩니다.

- `Netlify Drop`: 권장하지 않음
- `GitHub Pages`: 권장하지 않음
- `Vercel`: 바로 한 번에 올리기엔 구조를 더 바꿔야 해서 지금 기준 비추천

가장 현실적인 무료 운영 방법:

- `Render` 웹서비스
- `Supabase` 데이터베이스

## 무엇을 올리면 되나요?

이 `deploy-upload-render` 폴더 전체를 GitHub 저장소에 올린 뒤, Render에서 그 저장소를 연결하면 됩니다.

즉, 업로드 대상은 이 폴더 안의 파일들입니다.

- `apps/`
- `package.json`
- `render.yaml`
- `README.md`
- `.gitignore`

## 아주 짧게 순서만 적으면

1. 이 폴더 내용을 새 GitHub 저장소에 업로드
2. Supabase에서 새 프로젝트 생성
3. Supabase의 `DATABASE_URL` 복사
4. Render에서 GitHub 저장소 연결
5. Render 환경변수 설정

필요한 환경변수:

```env
NODE_ENV=production
ADMIN_PASSWORD=원하는관리자비밀번호
DATABASE_URL=Supabase에서복사한값
```

## 참고

지금 로컬에서 `CoffeeOrderServer.exe`로 실행하는 버전은 Windows 전용 실행 흐름이고,
이 폴더는 온라인 배포용 `apps/web + apps/server` 묶음입니다.

온라인 버전도 로컬 최신 기능과 완전히 같게 맞추려면 한 번 더 포팅 작업이 필요합니다.
