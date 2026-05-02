# 음료 주문 취합 앱

사내 음료 주문을 빠르게 모으고, 관리자 화면에서 주문 집계와 CSV 내보내기를 할 수 있는 앱입니다.

## 로컬 실행

Node.js 없이 바로 쓰려면 `CoffeeOrderServer.exe`를 실행하면 됩니다.

- 주문 화면: `http://localhost:5173`
- 관리자 화면: `http://localhost:5173/admin`
- 기본 관리자 비밀번호: `change-me`

Node.js가 있는 환경에서는 아래처럼 실행할 수 있습니다.

```powershell
cd "C:\Users\user\Documents\@CODEX\음료주문앱"
npm install
npm run dev
```

## 배포 구조

배포용 앱은 아래 구조를 기준으로 동작합니다.

- `apps/web`: Vite + React 프론트엔드
- `apps/server`: Express API + 정적 파일 서빙
- `render.yaml`: Render 무료 웹 서비스용 설정

배포 시에는 Express 서버가 `apps/web/dist`를 함께 서빙하므로, 프론트와 API를 한 URL로 운영할 수 있습니다.

## 무료 운영 추천 조합

현재 기준으로 가장 무난한 조합은 아래입니다.

1. 웹 서버: Render Free Web Service
2. 데이터베이스: Supabase Free Postgres

이유:

- Render는 Node 웹 서비스를 무료로 올리기 쉽습니다.
- Supabase는 무료 Postgres를 제공하고, 앱에서 일반 `DATABASE_URL`로 바로 연결할 수 있습니다.
- Render 무료 Postgres는 공식 문서 기준 30일 만료가 있어서 운영용으로는 부적합합니다.

참고:

- Render Free Web Service: [https://render.com/free](https://render.com/free)
- Supabase Free Plan: [https://supabase.com/docs/guides/platform/billing-on-supabase](https://supabase.com/docs/guides/platform/billing-on-supabase)

## Render 배포 순서

1. GitHub에 이 저장소를 올립니다.
2. Supabase에서 새 프로젝트를 하나 만듭니다.
3. Supabase 프로젝트의 Postgres 연결 문자열을 복사합니다.
4. Render에서 `Blueprint` 또는 `New Web Service`로 이 저장소를 연결합니다.
5. 아래 환경 변수를 설정합니다.

```env
NODE_ENV=production
ADMIN_PASSWORD=원하는-관리자-비밀번호
DATABASE_URL=Supabase에서-복사한-Postgres-연결문자열
```

6. Render가 빌드를 마치면 `/api/health`로 상태를 확인합니다.
7. 배포 URL의 `/admin`으로 관리자 화면에 들어갑니다.

## 주의 사항

- 현재 로컬 전용 `CoffeeOrderServer.exe`와 `scripts/standalone-server.ps1`는 Windows 단독 실행용입니다.
- 무료 호스팅용 배포는 `apps/web` + `apps/server` 기준으로 준비되어 있습니다.
- Supabase Free 프로젝트는 비활성 상태가 오래 지속되면 일시 정지될 수 있으니, 운영 전에는 꼭 이해하고 쓰는 편이 좋습니다.

## 환경 변수

`apps/server/.env` 또는 배포 환경 변수에 아래 값을 넣으면 됩니다.

```env
PORT=3000
DATABASE_URL=./coffee-orders.sqlite
ADMIN_PASSWORD=change-me
```

로컬에서는 `DATABASE_URL=./coffee-orders.sqlite`를 그대로 써도 되고, 배포에서는 Postgres 연결 문자열로 바꾸면 됩니다.
