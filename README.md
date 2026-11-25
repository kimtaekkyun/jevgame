# 인생은 객관식

TypeSafe의 Jev System One 또는 OpenRouter Jev Decisions API로 상황과 질문을 평가하는 웹앱입니다. 공통 `state`를 자연어 또는 JSON으로 입력하고 `choice`, `noul`, `score`, `box` 유형의 `questions`를 추가해 한 번에 실행할 수 있습니다. 「바로 결과 보기」는 결과를 입력 아래에 바로 보여주고, 「Jev의 선택은? 🪙」은 별도 화면에서 연출과 함께 보여줍니다.

## 시작하기

필요 환경: Node.js 20.9 이상

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 사용할 제공자의 키를 입력합니다. `TYPESAFE_API_KEY`가 있으면 TypeSafe를 사용하고, 없으면 `OPENROUTER_API_KEY`로 OpenRouter를 사용합니다. 두 키가 모두 있으면 TypeSafe가 우선입니다.

```env
TYPESAFE_API_KEY=your-typesafe-api-key
TYPESAFE_MODEL=jev-latest

# TypeSafe 키가 없을 때 사용하는 대체 제공자
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=~typesafe/jev-latest
APP_URL=http://localhost:3000
```

키는 서버 환경 변수로만 관리하고 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. 선택된 제공자의 요청이 실패하면 다른 제공자로 재시도하지 않고 오류를 반환합니다.

앱을 공개하기 전에 입장 잠금을 설정합니다. `ENTRY_CODE`는 초대할 사람에게 공유할 코드이고, `ACCESS_SESSION_SECRET`은 서명용 무작위 비밀값입니다. 예를 들어 다음 명령으로 서명용 값을 생성할 수 있습니다.

```bash
openssl rand -base64 32
```

생성된 값을 포함해 두 변수를 로컬 `.env.local` 또는 Vercel의 서버 환경 변수(Secret)에 설정하세요.

```env
ENTRY_CODE=길고_추측하기_어려운_초대_코드
ACCESS_SESSION_SECRET=위_명령으로_생성한_무작위_값
```

입장 세션은 7일 동안 유지되고, `ENTRY_CODE`를 바꾸면 기존 세션도 만료됩니다. 공유 코드 방식은 간단한 접근 제한용이므로, 공개 서비스의 강한 사용자 인증이나 요청별 rate limit을 대신하지는 않습니다.

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

## 지원 기능

- **Choice**: 선택지와 설명을 입력하면 연출은 사다리 타기로 보여줍니다. 시작 자리를 고르면 Jev의 선택이 도착 칸에 놓이고, 확률은 도착 후에 공개됩니다.
- **Noul**: 예/아니오 조건의 확률을 확인하며, 필요하면 true/false 기준을 지정합니다. 연출은 동전 던지기이고, 동전 앞·뒷면에는 true/false 기준 문구가 표시됩니다.
- **Score**: 순서형 평가 기준과 단계별 확률을 확인합니다. 연출은 펀치 머신으로, 아날로그 게이지와 디지털 숫자가 함께 올라갑니다. 표시 점수는 1~N점입니다.
- **Box**: PNG/JPEG 이미지를 첨부해 설명한 대상의 bounding box를 확인합니다.
- 한 요청에 여러 질문을 추가할 수 있습니다. 질문들은 같은 state를 기준으로 독립적으로 답변됩니다.
- `/api/decisions` Route Handler가 서버에서 TypeSafe 또는 `@openrouter/sdk`를 호출합니다. 제공자는 API 키의 존재 여부로 선택합니다.
- 입력 내용과 이미지는 실행 시 선택된 제공자에게 전송되며, 앱에는 결과를 저장하지 않습니다.

## 검증

```bash
npm run lint
npm run build
```
