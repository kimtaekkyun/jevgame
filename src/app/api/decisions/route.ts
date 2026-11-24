import { OpenRouter } from "@openrouter/sdk";
import type { DecisionsRequest } from "@openrouter/sdk/models";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface OptionInput {
  id: string;
  label: string;
  description?: string;
}

interface QuestionInput {
  id: string;
  type: "choice" | "noul" | "score" | "box";
  instructions: string;
  options?: OptionInput[];
  levels?: string[];
  trueDescription?: string;
  falseDescription?: string;
}

const SAFE_KEY = /^[a-zA-Z0-9_-]{1,48}$/;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "~typesafe/jev-latest";

  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY를 서버 환경변수에 설정해 주세요." }, { status: 503 });
  }

  let body: { state?: unknown; imageDataUrl?: unknown; questions?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 내용을 읽을 수 없습니다." }, { status: 400 });
  }

  const rawState = body.state;
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  let stateJson = "";
  try {
    stateJson = JSON.stringify(rawState ?? "");
  } catch {
    return NextResponse.json({ error: "공통 상태를 처리할 수 없습니다." }, { status: 400 });
  }
  if (stateJson.length > 8000) {
    return NextResponse.json({ error: "공통 상태는 8,000자 이내로 입력해 주세요." }, { status: 400 });
  }
  const validState = typeof rawState === "string"
    ? rawState.trim().length > 0
    : Boolean(rawState && typeof rawState === "object" && (Array.isArray(rawState) ? rawState.length > 0 : Object.keys(rawState).length > 0));
  if (imageDataUrl && (!IMAGE_DATA_URL.test(imageDataUrl) || imageDataUrl.length > 9_000_000)) {
    return NextResponse.json({ error: "이미지는 6MB 이하의 PNG 또는 JPEG 파일만 사용할 수 있습니다." }, { status: 400 });
  }
  if (!validState && !imageDataUrl) {
    return NextResponse.json({ error: "공통 상태에 설명을 입력하거나 이미지를 첨부해 주세요." }, { status: 400 });
  }
  if (!Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 8) {
    return NextResponse.json({ error: "질문은 1~8개까지 한 번에 실행할 수 있습니다." }, { status: 400 });
  }

  const questions: DecisionsRequest["questions"] = {};
  const questionIds = new Set<string>();

  for (const rawQuestion of body.questions) {
    if (!rawQuestion || typeof rawQuestion !== "object") {
      return NextResponse.json({ error: "질문 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const question = rawQuestion as QuestionInput;
    if (
      typeof question.id !== "string" ||
      !SAFE_KEY.test(question.id) ||
      questionIds.has(question.id) ||
      typeof question.instructions !== "string" ||
      !question.instructions.trim() ||
      question.instructions.length > 1000 ||
      !["choice", "noul", "score", "box"].includes(question.type)
    ) {
      return NextResponse.json({ error: "질문 이름, 지침 또는 유형을 확인해 주세요." }, { status: 400 });
    }
    questionIds.add(question.id);

    if (question.type === "choice") {
      if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 12) {
        return NextResponse.json({ error: "Choice 질문에는 2~12개의 선택지가 필요합니다." }, { status: 400 });
      }
      const optionIds = new Set<string>();
      const criteria: Record<string, string> = {};
      for (const option of question.options) {
        if (
          !option ||
          typeof option.id !== "string" ||
          !SAFE_KEY.test(option.id) ||
          optionIds.has(option.id) ||
          typeof option.label !== "string" ||
          !option.label.trim() ||
          option.label.length > 100 ||
          (option.description !== undefined && (typeof option.description !== "string" || option.description.length > 300))
        ) {
          return NextResponse.json({ error: "Choice 선택지 이름이나 설명을 확인해 주세요." }, { status: 400 });
        }
        optionIds.add(option.id);
        criteria[option.id] = `${option.label.trim()}${option.description?.trim() ? ` — ${option.description.trim()}` : ""}`;
      }
      questions[question.id] = { type: "choice", instructions: question.instructions.trim(), criteria };
    } else if (question.type === "noul") {
      const criteria: { true?: string; false?: string } = {};
      if (typeof question.trueDescription === "string" && question.trueDescription.trim()) criteria.true = question.trueDescription.trim();
      if (typeof question.falseDescription === "string" && question.falseDescription.trim()) criteria.false = question.falseDescription.trim();
      questions[question.id] = {
        type: "noul",
        instructions: question.instructions.trim(),
        ...(Object.keys(criteria).length > 0 ? { criteria } : {}),
      };
    } else if (question.type === "score") {
      if (!Array.isArray(question.levels) || question.levels.length < 2 || question.levels.length > 10) {
        return NextResponse.json({ error: "Score 질문에는 순서가 있는 기준이 2~10개 필요합니다." }, { status: 400 });
      }
      const levels = question.levels.map((level) => typeof level === "string" ? level.trim() : "");
      if (levels.some((level) => !level || level.length > 200)) {
        return NextResponse.json({ error: "Score 기준을 빠짐없이 입력해 주세요. 각 기준은 200자 이내입니다." }, { status: 400 });
      }
      questions[question.id] = { type: "score", instructions: question.instructions.trim(), criteria: levels };
    } else {
      if (!imageDataUrl) {
        return NextResponse.json({ error: "Box 질문에는 PNG 또는 JPEG 이미지가 필요합니다." }, { status: 400 });
      }
      questions[question.id] = { type: "box", instructions: question.instructions.trim() };
    }
  }

  const baseState = (validState ? rawState : "첨부된 이미지") as DecisionsRequest["state"];
  const state: DecisionsRequest["state"] = imageDataUrl
    ? [...(Array.isArray(baseState) ? baseState : [baseState]), { type: "image_url", image_url: { url: imageDataUrl } }]
    : baseState;

  try {
    const openrouter = new OpenRouter({
      apiKey,
      httpReferer: process.env.APP_URL ?? "http://localhost:3000",
      appTitle: "인생은 객관식",
    });

    const decision = await openrouter.alpha.decisions.create({
      decisionsRequest: { model, state, questions },
    });

    return NextResponse.json({
      model: decision.model,
      provider: decision.provider,
      answers: decision.answers,
      usage: decision.usage,
    });
  } catch (error) {
    console.error("OpenRouter Jev decision failed:", error);
    return NextResponse.json(
      { error: "Jev 요청에 실패했습니다. API 키, 모델 ID, 질문 입력 또는 OpenRouter 응답을 확인해 주세요." },
      { status: 502 },
    );
  }
}
