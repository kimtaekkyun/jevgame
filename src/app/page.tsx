"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import CoinFlip from "./coin-flip";
import LadderStage from "./ladder-stage";
import PunchStage from "./punch-stage";

type Primitive = "choice" | "noul" | "score" | "box";
type Option = { id: string; label: string; description: string };
type Question = {
  id: string;
  type: Primitive;
  instructions: string;
  options: Option[];
  levels: string[];
  trueDescription: string;
  falseDescription: string;
};
type JevAnswer = Record<string, unknown> & { type?: string };
type RunResult = {
  model?: string;
  provider?: string;
  answers: Record<string, JevAnswer>;
  usage?: Record<string, unknown>;
};
type View = "input" | "show";

const primitiveInfo: Record<Primitive, { title: string; subtitle: string; icon: string }> = {
  choice: { title: "Choice", subtitle: "여러 선택지 중 선택 + 확률", icon: "◉" },
  noul: { title: "Noul", subtitle: "예/아니오 조건의 확률", icon: "✓" },
  score: { title: "Score", subtitle: "순서형 기준으로 평가", icon: "▥" },
  box: { title: "Box", subtitle: "이미지 속 대상 위치 찾기", icon: "⌗" },
};

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeQuestion(type: Primitive, index: number): Question {
  return {
    id: makeId(`q${index + 1}`),
    type,
    instructions: "",
    options: [
      { id: makeId("opt"), label: "", description: "" },
      { id: makeId("opt"), label: "", description: "" },
    ],
    levels: ["", ""],
    trueDescription: "",
    falseDescription: "",
  };
}

function probability(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined;
}

function formatConfidence(value: unknown) {
  const parsed = probability(value);
  return parsed === undefined ? null : `${Math.round(parsed * 100)}% 신뢰도`;
}

function buildPreview(state: unknown, imageAttached: boolean, questions: Question[]) {
  const formattedQuestions: Record<string, unknown> = {};
  for (const question of questions) {
    if (question.type === "choice") {
      formattedQuestions[question.id] = {
        type: question.type,
        instructions: question.instructions || "(질문 지침)",
        criteria: Object.fromEntries(question.options.map((option, index) => [option.id || `option_${index + 1}`, `${option.label || "(선택지)"}${option.description ? ` — ${option.description}` : ""}`])),
      };
    } else if (question.type === "noul") {
      formattedQuestions[question.id] = {
        type: question.type,
        instructions: question.instructions || "(예/아니오 질문)",
        ...(question.trueDescription || question.falseDescription
          ? { criteria: { true: question.trueDescription || undefined, false: question.falseDescription || undefined } }
          : {}),
      };
    } else if (question.type === "score") {
      formattedQuestions[question.id] = { type: question.type, instructions: question.instructions || "(평가 지침)", criteria: question.levels };
    } else {
      formattedQuestions[question.id] = { type: question.type, instructions: question.instructions || "(이미지에서 찾을 대상)" };
    }
  }
  return {
    model: "~typesafe/jev-latest",
    state: imageAttached ? [state || "(설명 없음)", { type: "image_url", image_url: { url: "[data:image/png;base64,…]" } }] : state,
    questions: formattedQuestions,
  };
}

// Picks the reveal animation from the primitive type. Jev's answer is already known;
// each stage only decides how it is shown.
function StageView({ question, answer, isLast, onNext, onReplay }: {
  question: Question;
  answer: JevAnswer;
  isLast: boolean;
  onNext: () => void;
  onReplay: () => void;
}) {
  if (question.type === "noul" && answer.type === "noul") {
    const noul = probability(answer.noul) ?? 0;
    return (
      <CoinFlip
        question={question.instructions}
        yesLabel={question.trueDescription.trim() || "예"}
        noLabel={question.falseDescription.trim() || "아니오"}
        isYes={noul >= 0.5}
        probability={noul >= 0.5 ? noul : 1 - noul}
        isLast={isLast}
        onNext={onNext}
        onReplay={onReplay}
      />
    );
  }
  if (question.type === "choice" && answer.type === "choice") {
    const probabilities = (answer.probabilities ?? {}) as Record<string, number>;
    return (
      <LadderStage
        question={question.instructions}
        options={question.options.map((option) => ({ id: option.id, label: option.label, description: option.description }))}
        chosenId={String(answer.choice ?? "")}
        probabilities={probabilities}
        isLast={isLast}
        onNext={onNext}
        onReplay={onReplay}
      />
    );
  }
  if (question.type === "score" && answer.type === "score") {
    const scoreProbabilities = (answer.probabilities ?? {}) as Record<string, unknown>;
    return (
      <PunchStage
        question={question.instructions}
        levels={question.levels}
        raw={typeof answer.score === "number" ? answer.score : 0}
        probabilities={question.levels.map((_, index) => probability(scoreProbabilities[String(index)]) ?? 0)}
        isLast={isLast}
        onNext={onNext}
        onReplay={onReplay}
      />
    );
  }
  return (
    <div className="punch-drama">
      <p className="drama-line">이 질문은 연출을 지원하지 않아 요약으로 대체합니다.</p>
      <div className="drama-actions"><button className="primary-button drama-next" type="button" onClick={onNext}>{isLast ? "결과 요약" : "다음 질문"} <span>→</span></button></div>
    </div>
  );
}

function AnswerCards({ questions, result, imageDataUrl }: { questions: Question[]; result: RunResult; imageDataUrl: string }) {
  return (
    <div className="answer-grid">
      {questions.map((question, index) => {
        const answer = result.answers[question.id];
        if (!answer) return null;
        const confidence = formatConfidence(answer.confidence);
        return (
          <article className="answer-card" key={question.id}>
            <div className="answer-card-heading"><span className={`answer-type type-${question.type}`}>{primitiveInfo[question.type].title}</span><span>Q{String(index + 1).padStart(2, "0")}</span></div>
            <h3>{question.instructions}</h3>
            {confidence && <span className="confidence-pill">{confidence}</span>}

            {question.type === "choice" && answer.type === "choice" && (
              <div className="choice-answer-list">
                {question.options
                  .map((option) => ({ option, chance: probability((answer.probabilities as Record<string, unknown> | undefined)?.[option.id]) ?? (answer.choice === option.id ? 1 : 0) }))
                  .sort((a, b) => b.chance - a.chance)
                  .map(({ option, chance }, answerIndex) => (
                    <div className={`choice-answer ${answer.choice === option.id ? "chosen-answer" : ""}`} key={option.id}>
                      <div className="answer-label-row"><span>{answerIndex === 0 ? "✦" : ""} {option.label}</span><b>{Math.round(chance * 100)}%</b></div>
                      <div className="probability-track"><span style={{ width: `${chance * 100}%` }} /></div>
                      {option.description && <small>{option.description}</small>}
                    </div>
                  ))}
              </div>
            )}

            {question.type === "noul" && answer.type === "noul" && (
              <div className="noul-result">
                <div className="noul-meter" style={{ "--noul-value": `${(probability(answer.noul) ?? 0) * 100}%` } as CSSProperties}><span>{Math.round((probability(answer.noul) ?? 0) * 100)}%</span></div>
                <div><b>예일 확률</b><p>Jev가 판단한 조건의 가능성입니다.</p></div>
              </div>
            )}

            {question.type === "score" && answer.type === "score" && (
              <div className="score-result">
                <div className="score-total"><b>{typeof answer.score === "number" ? (answer.score + 1).toFixed(2) : "—"}<small> / {question.levels.length}</small></b><span>표시 점수 (1~{question.levels.length}점)</span>{typeof answer.score === "number" && <em>Jev 원본: {answer.score.toFixed(2)} (0-index)</em>}</div>
                {question.levels.map((level, levelIndex) => {
                  const chance = probability((answer.probabilities as Record<string, unknown> | undefined)?.[String(levelIndex)]) ?? 0;
                  return <div className="score-prob-row" key={`${question.id}-result-${levelIndex}`}><span>{level}</span><div className="probability-track"><span style={{ width: `${chance * 100}%` }} /></div><b>{Math.round(chance * 100)}%</b></div>;
                })}
              </div>
            )}

            {question.type === "box" && answer.type === "box" && imageDataUrl && (() => {
              if (!answer.box || typeof answer.box !== "object") return <p className="field-help">Box 좌표를 표시할 수 없는 응답입니다.</p>;
              const box = answer.box as { top?: number; bottom?: number; left?: number; right?: number };
              if (![box.top, box.bottom, box.left, box.right].every((value) => typeof value === "number" && Number.isFinite(value))) return <p className="field-help">Box 좌표를 표시할 수 없는 응답입니다.</p>;
              return (
                <div className="box-result-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageDataUrl} alt="Box 결과 이미지" />
                  <div className="box-rectangle" style={{ left: `${box.left! * 100}%`, top: `${box.top! * 100}%`, width: `${(box.right! - box.left!) * 100}%`, height: `${(box.bottom! - box.top!) * 100}%` }} />
                </div>
              );
            })()}

            {answer.type !== question.type && <pre className="raw-answer">{JSON.stringify(answer, null, 2)}</pre>}
          </article>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("input");
  const [stateMode, setStateMode] = useState<"text" | "json">("text");
  const [stateText, setStateText] = useState("");
  const [stateJson, setStateJson] = useState('{\n  "context": ""\n}');
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [questions, setQuestions] = useState<Question[]>(() => [makeQuestion("choice", 0)]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [staging, setStaging] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [stageRun, setStageRun] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const hasBoxQuestion = questions.some((question) => question.type === "box");
  // Questions that get a staged reveal. Box answers stay in the summary.
  const stageQuestions = questions.filter((question) => question.type !== "box");
  const jsonState = useMemo(() => {
    if (stateMode !== "json") return { valid: true as const, value: stateText.trim() };
    try {
      const value: unknown = JSON.parse(stateJson);
      if (!value || typeof value !== "object") return { valid: false as const, error: "JSON State는 객체 또는 배열이어야 합니다." };
      return { valid: true as const, value };
    } catch {
      return { valid: false as const, error: "JSON 형식을 확인해 주세요." };
    }
  }, [stateMode, stateJson, stateText]);
  const statePayload = useMemo(
    () => stateMode === "json" ? (jsonState.valid ? jsonState.value : {}) : stateText.trim(),
    [stateMode, jsonState, stateText],
  );
  const preview = useMemo(() => buildPreview(statePayload, Boolean(imageDataUrl), questions), [statePayload, imageDataUrl, questions]);

  const stageQuestion = staging ? stageQuestions[stageIndex] : undefined;
  const stageAnswer = stageQuestion && result ? result.answers[stageQuestion.id] : undefined;

  function resetOutput() {
    setResult(null);
    setStaging(false);
    setError("");
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));
    resetOutput();
  }

  function addQuestion(type: Primitive) {
    if (questions.length >= 8) return;
    const question = makeQuestion(type, questions.length);
    setQuestions((current) => [...current, question]);
    resetOutput();
  }

  function removeQuestion(id: string) {
    if (questions.length <= 1) return;
    setQuestions((current) => current.filter((question) => question.id !== id));
    resetOutput();
  }

  function updateOption(question: Question, optionId: string, patch: Partial<Option>) {
    updateQuestion(question.id, { options: question.options.map((option) => option.id === optionId ? { ...option, ...patch } : option) });
  }

  function addOption(question: Question) {
    if (question.options.length >= 12) return;
    updateQuestion(question.id, { options: [...question.options, { id: makeId("opt"), label: "", description: "" }] });
  }

  function removeOption(question: Question, optionId: string) {
    if (question.options.length <= 2) return;
    updateQuestion(question.id, { options: question.options.filter((option) => option.id !== optionId) });
  }

  function updateLevel(question: Question, index: number, value: string) {
    updateQuestion(question.id, { levels: question.levels.map((level, currentIndex) => currentIndex === index ? value : level) });
  }

  function addLevel(question: Question) {
    if (question.levels.length >= 10) return;
    updateQuestion(question.id, { levels: [...question.levels, ""] });
  }

  function removeLevel(question: Question, index: number) {
    if (question.levels.length <= 2) return;
    updateQuestion(question.id, { levels: question.levels.filter((_, currentIndex) => currentIndex !== index) });
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Box는 PNG 또는 JPEG 이미지를 사용해 주세요.");
      event.target.value = "";
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("이미지는 6MB 이하로 선택해 주세요.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageDataUrl(reader.result);
        setImageName(file.name);
        resetOutput();
      }
    };
    reader.readAsDataURL(file);
  }

  function loadTemplate(type: Primitive) {
    resetOutput();
    setStateMode("text");
    if (type !== "box") {
      setImageDataUrl("");
      setImageName("");
      if (fileInput.current) fileInput.current.value = "";
    }
    if (type === "choice") {
      setStateText("비 오는 금요일 저녁이다. 친구들과 메뉴를 고르려고 한다.");
      setQuestions([{
        ...makeQuestion("choice", 0),
        instructions: "이 상황에 가장 잘 어울리는 메뉴는 무엇인가요?",
        options: [
          { id: makeId("opt"), label: "곱창", description: "소주와 잘 어울리는 메뉴" },
          { id: makeId("opt"), label: "치킨", description: "편하게 나눠 먹기 좋음" },
          { id: makeId("opt"), label: "피자", description: "오늘따라 당기는 메뉴" },
        ],
      }]);
    } else if (type === "noul") {
      setStateText("사용자가 결제 버튼을 누른 뒤 화면이 멈췄다고 신고했다.");
      setQuestions([{
        ...makeQuestion("noul", 0),
        instructions: "이 내용은 소프트웨어 버그 신고인가요?",
        trueDescription: "버그 맞음",
        falseDescription: "버그 아님",
      }]);
    } else if (type === "score") {
      setStateText("고객이 결제에 실패했고 청구서 납부 기한이 지났다.");
      setQuestions([{
        ...makeQuestion("score", 0),
        instructions: "이 문의의 긴급도를 평가해 주세요.",
        levels: ["낮음 — 일반 문의", "보통 — 업무에 지장이 있으나 대안이 있음", "높음 — 결제나 계정 사용이 막힘"],
      }]);
    } else {
      setStateText("첨부한 이미지에서 찾고 싶은 대상을 설명해 주세요.");
      setQuestions([{
        ...makeQuestion("box", 0),
        instructions: "이미지에서 빨간 자전거의 위치를 찾아 주세요.",
      }]);
    }
  }

  const hasStateContent = stateMode === "text"
    ? stateText.trim().length > 0
    : jsonState.valid && (Array.isArray(jsonState.value) ? jsonState.value.length > 0 : Object.keys(jsonState.value).length > 0);
  const canRun = !loading
    && (stateMode !== "json" || jsonState.valid)
    && (hasStateContent || Boolean(imageDataUrl))
    && questions.length > 0
    && questions.every((question) => {
      if (!question.instructions.trim()) return false;
      if (question.type === "choice") return question.options.length >= 2 && question.options.every((option) => option.label.trim());
      if (question.type === "score") return question.levels.length >= 2 && question.levels.every((level) => level.trim());
      if (question.type === "box") return Boolean(imageDataUrl);
      return true;
    });

  async function requestJev(): Promise<RunResult> {
    const response = await fetch("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: jsonState.valid ? jsonState.value : stateText.trim(),
        imageDataUrl: imageDataUrl || undefined,
        questions,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Jev 요청에 실패했습니다.");
    return data as RunResult;
  }

  function failWith(caught: unknown) {
    setError(caught instanceof Error ? caught.message : "알 수 없는 오류가 발생했습니다.");
  }

  // "바로 결과 보기": answers appear right under the inputs.
  async function runDirect() {
    if (!canRun) return;
    setLoading(true);
    resetOutput();
    try {
      setResult(await requestJev());
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      failWith(caught);
    } finally {
      setLoading(false);
    }
  }

  // Used by the "Jev의 선택은?" screen, both on open and on "다시 던지기".
  async function requestShow() {
    setLoading(true);
    resetOutput();
    setStageIndex(0);
    setStageRun(0);
    try {
      const data = await requestJev();
      setResult(data);
      setStaging(stageQuestions.length > 0);
    } catch (caught) {
      failWith(caught);
    } finally {
      setLoading(false);
    }
  }

  function openShow() {
    if (!canRun) return;
    setView("show");
    void requestShow();
  }

  function backToInput() {
    setView("input");
    setStaging(false);
    setLoading(false);
  }

  function advanceStage() {
    if (stageIndex + 1 >= stageQuestions.length) {
      setStaging(false);
    } else {
      setStageIndex((index) => index + 1);
      setStageRun(0);
    }
  }


  if (view === "show") {
    return (
      <main className="jev-app show-screen">
        <header className="app-top">
          <a className="brand" href="#top" aria-label="인생은 객관식 홈" onClick={(event) => { event.preventDefault(); backToInput(); }}>
            <span className="brand-mark">객</span><span>인생은 객관식</span>
          </a>
          <button className="ghost-button" type="button" onClick={backToInput}>← 입력으로 돌아가기</button>
        </header>

        <section className="show-stage" id="top">
          <div className="show-heading">
            <span className="step-label">JEV&apos;S CHOICE</span>
            <h1>Jev의 선택은?</h1>
            {staging && stageQuestion && <p>{stageIndex + 1} / {stageQuestions.length} 번째 질문</p>}
          </div>

          {loading && (
            <div className="show-loading"><span className="button-spinner" /> Jev가 고르는 중...</div>
          )}

          {!loading && error && (
            <div className="error-box" role="alert">{error}</div>
          )}

          {!loading && !error && result && staging && stageQuestion && stageAnswer && (
            <StageView
              key={`${stageQuestion.id}-${stageRun}`}
              question={stageQuestion}
              answer={stageAnswer}
              isLast={stageIndex + 1 >= stageQuestions.length}
              onNext={advanceStage}
              onReplay={() => void requestShow()}
            />
          )}

          {!loading && !error && result && !staging && (
            <div className="show-summary">
              <AnswerCards questions={questions} result={result} imageDataUrl={imageDataUrl} />
            </div>
          )}

        </section>
      </main>
    );
  }

  return (
    <main className="jev-app" id="top">
      <header className="app-top">
        <a className="brand" href="#top" aria-label="인생은 객관식 홈">
          <span className="brand-mark">객</span><span>인생은 객관식</span>
        </a>
        <div className="app-tagline">답은 Jev가, 책임은 당신이 · <span className="model-pill"><span className="live-dot" /> JEV · DECISIONS</span></div>
      </header>

      <div className="template-strip">
        <span>빠른 예시</span>
        <button type="button" onClick={() => loadTemplate("choice")}>메뉴 · Choice</button>
        <button type="button" onClick={() => loadTemplate("noul")}>버그 판별 · Noul</button>
        <button type="button" onClick={() => loadTemplate("score")}>긴급도 · Score</button>
        <button type="button" onClick={() => loadTemplate("box")}>이미지 · Box</button>
      </div>

      <form className="app-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void runDirect(); }}>
        <div className="app-grid">
          <section className="panel state-col">
            <div className="col-heading">
              <div><span className="step-label">SHARED CONTEXT</span><h2>공통 상태 (State)</h2></div>
              <div className="state-mode-tabs" role="tablist" aria-label="State 입력 방식">
                <button className={stateMode === "text" ? "active" : ""} type="button" onClick={() => { setStateMode("text"); resetOutput(); }}>간편</button>
                <button className={stateMode === "json" ? "active" : ""} type="button" onClick={() => { setStateMode("json"); resetOutput(); }}>JSON</button>
              </div>
            </div>
            {stateMode === "text" ? (
              <textarea
                id="state-text"
                className="state-textarea"
                value={stateText}
                onChange={(event) => { setStateText(event.target.value); resetOutput(); }}
                placeholder="예: 고객이 결제 버튼을 누른 뒤 페이지가 멈춘다고 신고했어요."
                rows={4}
                maxLength={8000}
                aria-label="공통 State"
              />
            ) : (
              <textarea
                id="state-json"
                className="state-textarea json-state-input"
                value={stateJson}
                onChange={(event) => { setStateJson(event.target.value); resetOutput(); }}
                placeholder={'{\n  "ticket": "결제 버튼을 누른 뒤 페이지가 멈춤"\n}'}
                rows={4}
                maxLength={8000}
                spellCheck={false}
                aria-label="공통 State JSON"
              />
            )}
            {stateMode === "json" && !jsonState.valid && <p className="json-error">{jsonState.error}</p>}

            <div className="image-row">
              {imageDataUrl ? (
                <div className="image-preview-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageDataUrl} alt="Jev에 전달할 이미지 미리보기" className="state-image-preview" />
                  <div className="image-meta"><span>{imageName}</span><button type="button" onClick={() => { setImageDataUrl(""); setImageName(""); resetOutput(); if (fileInput.current) fileInput.current.value = ""; }}>제거 ×</button></div>
                </div>
              ) : (
                <button className="upload-zone" type="button" onClick={() => fileInput.current?.click()}>
                  <span className="upload-symbol">＋</span><b>이미지 선택</b><small>PNG/JPEG · Box용 · 6MB 이하</small>
                </button>
              )}
              <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg" onChange={handleImage} />
              {hasBoxQuestion && !imageDataUrl && <p className="field-help">Box 질문에는 이미지가 필요합니다.</p>}
            </div>
            <p className="field-help">모든 질문이 이 State를 함께 참고합니다. {stateMode === "text" ? "JSON 탭에서 구조화된 데이터도 입력할 수 있어요." : ""}</p>
          </section>

          <section className="panel questions-col">
            <div className="col-heading">
              <div><span className="step-label">TYPED QUESTIONS</span><h2>질문 (Questions) <small>{questions.length}/8</small></h2></div>
              <div className="add-type-row" aria-label="질문 추가">
                {(Object.keys(primitiveInfo) as Primitive[]).map((type) => (
                  <button type="button" className={`add-type-button add-${type}`} key={type} onClick={() => addQuestion(type)} disabled={questions.length >= 8} title={`${primitiveInfo[type].title} 질문 추가`}>
                    <b>{primitiveInfo[type].icon}</b>+ {primitiveInfo[type].title}
                  </button>
                ))}
              </div>
            </div>

            <div className="question-scroll">
              {questions.map((question, questionIndex) => (
                <article className="question-card" key={question.id}>
                  <div className="question-top">
                    <span className="question-index">Q{String(questionIndex + 1).padStart(2, "0")}</span>
                    <div className="type-switch" role="group" aria-label={`질문 ${questionIndex + 1} 유형`}>
                      {(Object.keys(primitiveInfo) as Primitive[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={`type-chip chip-${type} ${question.type === type ? "is-active" : ""}`}
                          aria-pressed={question.type === type}
                          onClick={() => { if (question.type !== type) updateQuestion(question.id, { type }); }}
                        >
                          <span>{primitiveInfo[type].icon}</span>{primitiveInfo[type].title}
                        </button>
                      ))}
                    </div>
                    {questions.length > 1 && <button className="remove-question" type="button" onClick={() => removeQuestion(question.id)} aria-label="질문 삭제">×</button>}
                  </div>

                  <textarea
                    id={`instructions-${question.id}`}
                    className="instructions-input"
                    value={question.instructions}
                    onChange={(event) => updateQuestion(question.id, { instructions: event.target.value })}
                    placeholder={question.type === "choice" ? "질문: 이 상황에 가장 적합한 선택지는?" : question.type === "noul" ? "질문: 이 내용은 소프트웨어 버그 신고인가요?" : question.type === "score" ? "질문: 요청의 긴급도를 평가해 주세요." : "질문: 이미지에서 빨간 자전거의 위치를 찾아 주세요."}
                    rows={2}
                    maxLength={1000}
                    aria-label={`질문 ${questionIndex + 1} 지침`}
                    required
                  />

                  {question.type === "choice" && (
                    <div className="criteria-compact">
                      {question.options.map((option, optionIndex) => (
                        <div className="option-editor-row" key={option.id}>
                          <span className={`choice-number color-${optionIndex % 4}`}>{optionIndex + 1}</span>
                          <input aria-label={`선택지 ${optionIndex + 1}`} value={option.label} onChange={(event) => updateOption(question, option.id, { label: event.target.value })} placeholder={`선택지 ${optionIndex + 1}`} maxLength={100} required />
                          <input aria-label={`선택지 ${optionIndex + 1} 설명`} value={option.description} onChange={(event) => updateOption(question, option.id, { description: event.target.value })} placeholder="설명 (선택)" maxLength={300} />
                          {question.options.length > 2 && <button className="remove-option" type="button" onClick={() => removeOption(question, option.id)} aria-label="선택지 삭제">×</button>}
                        </div>
                      ))}
                      <button className="text-button" type="button" onClick={() => addOption(question)} disabled={question.options.length >= 12}>＋ 선택지 추가</button>
                    </div>
                  )}

                  {question.type === "noul" && (
                    <div className="criteria-compact">
                      <div className="boolean-criteria">
                        <label><span className="boolean-label yes-label">TRUE · 예 (동전 앞면에도 표시)</span><input value={question.trueDescription} onChange={(event) => updateQuestion(question.id, { trueDescription: event.target.value })} placeholder="예: 버그 맞음" maxLength={60} /></label>
                        <label><span className="boolean-label no-label">FALSE · 아니오 (동전 뒷면에도 표시)</span><input value={question.falseDescription} onChange={(event) => updateQuestion(question.id, { falseDescription: event.target.value })} placeholder="예: 버그 아님" maxLength={60} /></label>
                      </div>
                    </div>
                  )}

                  {question.type === "score" && (
                    <div className="criteria-compact">
                      {question.levels.map((level, levelIndex) => (
                        <div className="score-level-row" key={`${question.id}-level-${levelIndex}`}>
                          <span className={`score-index ${levelIndex === 0 ? "score-low" : levelIndex === question.levels.length - 1 ? "score-high" : ""}`}>{levelIndex + 1}</span>
                          <input value={level} onChange={(event) => updateLevel(question, levelIndex, event.target.value)} placeholder={levelIndex === 0 ? "낮음 (낮은 단계부터)" : levelIndex === question.levels.length - 1 ? "높음" : "보통"} maxLength={200} required />
                          {question.levels.length > 2 && <button className="remove-option" type="button" onClick={() => removeLevel(question, levelIndex)} aria-label="평가 기준 삭제">×</button>}
                        </div>
                      ))}
                      <button className="text-button" type="button" onClick={() => addLevel(question)} disabled={question.levels.length >= 10}>＋ 기준 추가</button>
                    </div>
                  )}

                  {question.type === "box" && (
                    <p className={`box-help ${imageDataUrl ? "box-ready" : "box-missing"}`}>{imageDataUrl ? `✓ 이미지 준비 완료 · ${imageName}` : "▧ 왼쪽에서 이미지를 선택해 주세요."}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="action-bar">
          {error && view === "input" && <div className="error-box" role="alert">{error}</div>}
          <div className="run-row">
            <button className="primary-button run-button" type="submit" disabled={!canRun}>
              {loading && view === "input" ? <><span className="button-spinner" /> 판단 중...</> : <>바로 결과 보기 <span>↗</span></>}
            </button>
            {stageQuestions.length > 0 && (
              <button className="primary-button show-button" type="button" disabled={!canRun} onClick={openShow}>
                Jev의 선택은? <span>🪙</span>
              </button>
            )}
          </div>
          <p className="privacy-note">입력한 State와 이미지는 OpenRouter로 전송됩니다. 민감한 개인정보는 입력하지 마세요.</p>
        </div>
      </form>

      {result && (
        <section className="panel results-panel" aria-live="polite" ref={resultsRef}>
          <div className="section-heading">
            <div className="section-title-wrap"><span className="section-number section-number-green">↓</span><div><span className="step-label">TYPED ANSWERS</span><h2>Jev 응답</h2></div></div>
            <span className="response-model">{result.model ?? "Jev"}{result.provider ? ` · ${result.provider}` : ""}</span>
          </div>
          <AnswerCards questions={questions} result={result} imageDataUrl={imageDataUrl} />
          {result.usage && (
            <div className="usage-row">
              <span>INPUT {String(result.usage.inputTokens ?? result.usage.input_tokens ?? "—")} tokens</span>
              <span>OUTPUT {String(result.usage.outputTokens ?? result.usage.output_tokens ?? "—")} tokens</span>
              {typeof result.usage.cost === "number" && <span>${result.usage.cost.toFixed(6)}</span>}
            </div>
          )}
        </section>
      )}

      <details className="request-preview">
        <summary>Jev에 전달될 요청 구조 보기</summary>
        <pre>{JSON.stringify(preview, null, 2)}</pre>
      </details>
      <footer className="playground-footer">인생은 객관식 · Jev는 typed answer와 확률을 반환하며, 자유 형식의 이유나 중계 문구는 생성하지 않습니다.</footer>
    </main>
  );
}
