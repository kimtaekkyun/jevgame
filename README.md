# 인생은 객관식

OpenRouter의 Jev Decisions API로 상황과 질문을 구성해 답을 받는 웹앱입니다. 공통 `state`를 자연어 또는 JSON으로 입력하고 `choice`, `noul`, `score`, `box` 유형의 `questions`를 추가해 한 번에 실행할 수 있습니다. 「바로 결과 보기」는 결과를 입력 아래에 바로 보여주고, 「Jev의 선택은? 🪙」은 별도 화면에서 연출과 함께 보여줍니다.

## 시작하기

필요 환경: Node.js 20.9 이상

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 OpenRouter 설정을 입력합니다.

```env
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=~typesafe/jev-latest
APP_URL=http://localhost:3000
```

API 키는 서버 환경 변수로만 관리하고 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

## Interactive CLI

프로젝트 루트에서 실행합니다. `.env.local`에 있는 OpenRouter 키와 Jev 모델 설정을 자동으로 읽습니다.

```bash
npm run jev
```

실제 API를 호출하지 않고 요청 JSON만 확인하려면 다음처럼 실행합니다.

```bash
npm run jev -- --dry-run
```

CLI에서 공통 State를 여러 줄로 입력하고 `.` 한 줄로 마칩니다. 그다음 Choice/Noul/Score/Box를 하나 이상 추가하고 요청 내용을 확인한 뒤 실행할 수 있습니다. Box는 PNG/JPEG 파일 경로를 입력합니다.

## 지원 기능

- **Choice**: 선택지와 설명을 입력하면 연출은 사다리 타기로 보여줍니다. 시작 자리를 고르면 Jev의 선택이 도착 칸에 놓이고, 확률은 도착 후에 공개됩니다.
- **Noul**: 예/아니오 조건의 확률을 확인하며, 필요하면 true/false 기준을 지정합니다. 연출은 동전 던지기이고, 동전 앞·뒷면에는 true/false 기준 문구가 표시됩니다.
- **Score**: 순서형 평가 기준과 단계별 확률을 확인합니다. 연출은 펀치 머신으로, 아날로그 게이지와 디지털 숫자가 함께 올라갑니다. 표시 점수는 1~N점입니다.
- **Box**: PNG/JPEG 이미지를 첨부해 설명한 대상의 bounding box를 확인합니다.
- 한 요청에 여러 질문을 추가할 수 있습니다. 질문들은 같은 state를 기준으로 독립적으로 답변됩니다.
- `/api/decisions` Route Handler가 `@openrouter/sdk`의 `alpha.decisions.create`를 서버에서 호출합니다.
- 입력 내용과 이미지는 실행 시 OpenRouter로 전송되며, 앱에는 결과를 저장하지 않습니다.

## 검증

```bash
npm run lint
npm run build
```
