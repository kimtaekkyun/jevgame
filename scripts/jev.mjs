#!/usr/bin/env node
import { OpenRouter } from "@openrouter/sdk";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

const color = output.isTTY ? {
  reset: "\u001b[0m",
  violet: "\u001b[35m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
} : { reset: "", violet: "", cyan: "", green: "", yellow: "", red: "", dim: "", bold: "" };

const rl = readline.createInterface({ input, output });
const bufferedLines = [];
let lineWaiter;
let inputEnded = false;
rl.on("line", (line) => {
  if (lineWaiter) {
    const resolve = lineWaiter;
    lineWaiter = undefined;
    resolve(line);
  } else {
    bufferedLines.push(line);
  }
});
rl.on("close", () => {
  inputEnded = true;
  if (lineWaiter) {
    const resolve = lineWaiter;
    lineWaiter = undefined;
    resolve(null);
  }
});
const model = process.env.OPENROUTER_MODEL || "~typesafe/jev-latest";
const dryRun = process.argv.includes("--dry-run");
const questions = {};
let stateText = "";
let imagePart;
let imageName = "";
let nextQuestion = 1;

function paint(value, tone) {
  return `${color[tone]}${value}${color.reset}`;
}

async function readLine(prompt) {
  output.write(prompt);
  if (bufferedLines.length > 0) return bufferedLines.shift();
  if (inputEnded) return null;
  return new Promise((resolve) => { lineWaiter = resolve; });
}

async function ask(prompt) {
  const answer = await readLine(`${paint("?", "violet")} ${prompt} `);
  if (answer === null) throw new Error("입력이 종료되었습니다.");
  return answer.trim();
}

async function askRequired(prompt) {
  while (true) {
    const value = await ask(prompt);
    if (value) return value;
    console.log(paint("값을 입력해 주세요.", "yellow"));
  }
}

async function askMultiline(title) {
  console.log(`\n${paint(title, "bold")} ${paint("(입력을 마치려면 점 하나만 입력)", "dim")}`);
  const lines = [];
  while (true) {
    const line = await readLine("> ");
    if (line === null || line.trim() === ".") break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

function expandPath(filePath) {
  return filePath.startsWith("~/") ? path.join(os.homedir(), filePath.slice(2)) : path.resolve(filePath);
}

async function readImage() {
  while (!imagePart) {
    const filePath = await ask("Box 질문에 쓸 PNG/JPEG 경로 (취소하려면 q):");
    if (!filePath || filePath.toLowerCase() === "q") return false;

    const resolvedPath = expandPath(filePath);
    const extension = path.extname(resolvedPath).toLowerCase();
    const mimeType = extension === ".png" ? "image/png" : [".jpg", ".jpeg"].includes(extension) ? "image/jpeg" : "";
    if (!mimeType) {
      console.log(paint("PNG, JPG 또는 JPEG 파일을 선택해 주세요.", "yellow"));
      continue;
    }

    try {
      const fileInfo = await stat(resolvedPath);
      if (fileInfo.size > 6 * 1024 * 1024) {
        console.log(paint("이미지는 6MB 이하로 선택해 주세요.", "yellow"));
        continue;
      }
      const encoded = (await readFile(resolvedPath)).toString("base64");
      imagePart = { type: "image_url", image_url: { url: `data:${mimeType};base64,${encoded}` } };
      imageName = path.basename(resolvedPath);
      console.log(paint(`이미지 첨부: ${imageName}`, "green"));
      return true;
    } catch (error) {
      console.log(paint(`파일을 읽지 못했습니다: ${error instanceof Error ? error.message : String(error)}`, "red"));
    }
  }
  return true;
}

async function addChoiceQuestion(key) {
  const instructions = await askRequired("무엇을 고를까요? 질문 지침:");
  console.log(paint("선택지를 한 줄씩 입력하세요. 형식: 이름 | 설명 (설명은 생략 가능)", "dim"));
  const options = [];
  while (true) {
    const line = await readLine(`${paint(`선택지 ${options.length + 1}`, "cyan")} (끝내려면 Enter): `);
    if (line === null) throw new Error("입력이 종료되었습니다.");
    if (!line.trim()) break;
    const separator = line.indexOf("|");
    const label = (separator >= 0 ? line.slice(0, separator) : line).trim();
    const description = separator >= 0 ? line.slice(separator + 1).trim() : "";
    if (!label) {
      console.log(paint("선택지 이름이 비어 있습니다.", "yellow"));
      continue;
    }
    options.push({ id: `option_${options.length + 1}`, label, description });
  }
  if (options.length < 2) {
    console.log(paint("Choice에는 최소 두 개의 선택지가 필요합니다. 질문을 추가하지 않았습니다.", "yellow"));
    return false;
  }
  questions[key] = {
    type: "choice",
    instructions,
    criteria: Object.fromEntries(options.map(({ id, label, description }) => [id, description ? `${label} — ${description}` : label])),
  };
  return true;
}

async function addNoulQuestion(key) {
  const instructions = await askRequired("어떤 조건이 참인지 판단할까요? 질문 지침:");
  const yes = await ask("예(TRUE)로 볼 설명 (선택):");
  const no = await ask("아니오(FALSE)로 볼 설명 (선택):");
  questions[key] = {
    type: "noul",
    instructions,
    ...(yes || no ? { criteria: { ...(yes ? { true: yes } : {}), ...(no ? { false: no } : {}) } } : {}),
  };
  return true;
}

async function addScoreQuestion(key) {
  const instructions = await askRequired("무엇을 어느 정도로 평가할까요? 질문 지침:");
  console.log("척도를 고르세요: 1) 일반 5단계  2) 낮음/보통/높음  3) 동의도 5단계  4) 직접 입력");
  const preset = await ask("척도 [1/2/3/4]:");
  let criteria;
  if (preset === "1") {
    criteria = ["1점 — 매우 낮음", "2점 — 낮음", "3점 — 보통", "4점 — 높음", "5점 — 매우 높음"];
  } else if (preset === "2") {
    criteria = ["낮음", "보통", "높음"];
  } else if (preset === "3") {
    criteria = [
      "1점 — 매우 동의하지 않음",
      "2점 — 동의하지 않음",
      "3점 — 중립",
      "4점 — 동의함",
      "5점 — 매우 동의함",
    ];
  } else {
    console.log(paint("낮은 단계부터 높은 단계 순으로 한 줄씩 입력하세요. 빈 줄로 끝냅니다.", "dim"));
    criteria = [];
    while (true) {
      const level = await readLine(`${paint(`기준 ${criteria.length + 1}`, "cyan")} (끝내려면 Enter): `);
      if (level === null) throw new Error("입력이 종료되었습니다.");
      if (!level.trim()) break;
      criteria.push(level.trim());
    }
  }
  if (criteria.length < 2) {
    console.log(paint("Score에는 순서가 있는 기준이 최소 두 개 필요합니다. 질문을 추가하지 않았습니다.", "yellow"));
    return false;
  }
  questions[key] = { type: "score", instructions, criteria };
  return true;
}

async function addBoxQuestion(key) {
  if (!await readImage()) {
    console.log(paint("이미지가 없어 Box 질문을 추가하지 않았습니다.", "yellow"));
    return false;
  }
  const instructions = await askRequired("이미지에서 어떤 대상을 찾을까요?:");
  questions[key] = { type: "box", instructions };
  return true;
}

async function addQuestion() {
  console.log(`\n${paint("질문 유형", "bold")}  1) Choice  2) Noul  3) Score  4) Box  0) 실행`);
  const type = await ask("유형 선택:");
  if (type === "0") return false;

  const key = `q${nextQuestion}`;
  let added = false;
  if (type === "1" || type.toLowerCase() === "choice") added = await addChoiceQuestion(key);
  else if (type === "2" || type.toLowerCase() === "noul") added = await addNoulQuestion(key);
  else if (type === "3" || type.toLowerCase() === "score") added = await addScoreQuestion(key);
  else if (type === "4" || type.toLowerCase() === "box") added = await addBoxQuestion(key);
  else console.log(paint("1~4 중에서 선택해 주세요.", "yellow"));

  if (added) {
    nextQuestion += 1;
    const q = questions[key];
    console.log(paint(`추가됨: ${key} · ${q.type}`, "green"));
  }
  return true;
}

function showRequestSummary() {
  console.log(`\n${paint("요청 미리보기", "bold")}`);
  console.log(`${paint("State", "cyan")}: ${stateText || (imageName ? `[이미지: ${imageName}]` : "(비어 있음)")}`);
  if (imageName && stateText) console.log(`${paint("Image", "cyan")}: ${imageName}`);
  for (const [key, question] of Object.entries(questions)) {
    console.log(`  ${paint(key, "violet")} [${question.type}] ${question.instructions}`);
    if (question.type === "choice") {
      for (const [option, description] of Object.entries(question.criteria)) console.log(`    - ${option}: ${description}`);
    } else if (question.type === "score") {
      question.criteria.forEach((level, index) => console.log(`    ${index + 1}. ${level}`));
    }
  }
}

function printAnswers(result) {
  console.log(`\n${paint("Jev 응답", "bold")} · ${result.model}${result.provider ? ` (${result.provider})` : ""}`);
  for (const [key, question] of Object.entries(questions)) {
    const answer = result.answers?.[key];
    console.log(`\n${paint(`${key} · ${question.type.toUpperCase()}`, "violet")} — ${question.instructions}`);
    if (!answer) {
      console.log(paint("응답이 없습니다.", "yellow"));
      continue;
    }
    if (answer.type === "choice") {
      const labels = question.type === "choice" ? question.criteria : {};
      const probabilities = answer.probabilities ?? {};
      const entries = Object.entries(labels).map(([id, label]) => ({ id, label, probability: probabilities[id] ?? 0 }));
      entries.sort((a, b) => b.probability - a.probability);
      console.log(`선택: ${paint(labels[answer.choice] ?? answer.choice, "green")}`);
      for (const entry of entries) console.log(`  ${entry.label}: ${(entry.probability * 100).toFixed(1)}%`);
    } else if (answer.type === "noul") {
      console.log(`예일 확률: ${paint(`${(answer.noul * 100).toFixed(1)}%`, "green")}`);
    } else if (answer.type === "score") {
      const criteria = question.type === "score" ? question.criteria : [];
      const rawScore = answer.score;
      console.log(`점수: ${paint(`${(rawScore + 1).toFixed(2)} / ${criteria.length}`, "green")} ${paint(`(Jev 원본 ${rawScore.toFixed(2)}, 0-index)`, "dim")}`);
      criteria.forEach((level, index) => console.log(`  ${index + 1}. ${level}: ${((answer.probabilities?.[String(index)] ?? 0) * 100).toFixed(1)}%`));
    } else if (answer.type === "box") {
      const box = answer.box;
      console.log(`위치: top ${(box.top * 100).toFixed(1)}%, bottom ${(box.bottom * 100).toFixed(1)}%, left ${(box.left * 100).toFixed(1)}%, right ${(box.right * 100).toFixed(1)}%`);
    } else {
      console.log(JSON.stringify(answer, null, 2));
    }
    if (typeof answer.confidence === "number") console.log(paint(`신뢰도: ${(answer.confidence * 100).toFixed(1)}%`, "dim"));
  }

  if (result.usage) {
    const { inputTokens, outputTokens, cost } = result.usage;
    console.log(`\n${paint("사용량", "dim")}: ${inputTokens} input / ${outputTokens} output${typeof cost === "number" ? ` · $${cost.toFixed(6)}` : ""}`);
  }
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY && !dryRun) {
    throw new Error("OPENROUTER_API_KEY가 없습니다. 프로젝트 루트의 .env.local에 설정하거나 환경변수로 지정하세요.");
  }

  console.log(`\n${paint("Jev Interactive CLI", "bold")} ${paint(`· ${model}`, "dim")}`);
  console.log(paint("한 State에 여러 typed question을 추가해 한 번에 실행합니다.", "dim"));
  stateText = await askMultiline("공통 State 입력");

  let continueAdding = true;
  while (continueAdding) {
    if (Object.keys(questions).length >= 8) {
      console.log(paint("질문은 최대 8개까지 추가할 수 있습니다.", "yellow"));
      break;
    }
    continueAdding = await addQuestion();
  }

  if (Object.keys(questions).length === 0) {
    console.log(paint("실행할 질문이 없습니다.", "yellow"));
    return;
  }
  if (!stateText && !imagePart) {
    throw new Error("State를 입력하거나 Box 질문에 사용할 이미지를 첨부해야 합니다.");
  }

  showRequestSummary();
  const confirmation = await ask("OpenRouter에 전송할까요? [Y/n]:");
  if (["n", "no"].includes(confirmation.toLowerCase())) {
    console.log("취소했습니다.");
    return;
  }

  const state = imagePart ? [stateText || `Image: ${imageName}`, imagePart] : stateText;
  if (dryRun) {
    const previewState = imagePart
      ? [stateText || `Image: ${imageName}`, { type: "image_url", image_url: { url: `[${imageName} attached]` } }]
      : state;
    console.log(`\n${paint("Dry run — API 호출은 하지 않았습니다.", "yellow")}`);
    console.log(JSON.stringify({ model, state: previewState, questions }, null, 2));
    return;
  }
  const openrouter = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    httpReferer: process.env.APP_URL ?? "http://localhost:3000",
    appTitle: "인생은 객관식 CLI",
  });
  const result = await openrouter.alpha.decisions.create({
    decisionsRequest: { model, state, questions },
  });
  printAnswers(result);
}

try {
  await main();
} catch (error) {
  console.error(`\n${paint("오류", "red")}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
