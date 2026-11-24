"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  question: string;
  levels: string[];
  raw: number; // Jev score on the 0-indexed scale, 0 .. levels.length - 1
  probabilities: number[]; // one value per level, same order as levels
  isLast: boolean;
  onNext: () => void;
  onReplay: () => void;
};

const CLIMB_MS = 3800;
const SWEEP = 240; // gauge sweep in degrees, centered on 12 o'clock
const CX = 100;
const CY = 100;
const NEEDLE_LEN = 78;

function easeOutBack(t: number) {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function needleAngle(value: number, max: number) {
  const ratio = max <= 0 ? 0 : value / max;
  return -SWEEP / 2 + ratio * SWEEP;
}

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

export default function PunchStage({ question, levels, raw, probabilities, isLast, onNext, onReplay }: Props) {
  const max = Math.max(1, levels.length - 1);
  const [phase, setPhase] = useState<"ready" | "climb" | "reveal">("ready");
  const [value, setValue] = useState(0);
  const [squash, setSquash] = useState(false);
  const frameRef = useRef(0);

  useEffect(() => {
    if (phase !== "climb") return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / CLIMB_MS);
      const eased = easeOutBack(t);
      const jitter = (1 - t) * 0.12 * Math.sin(now / 37);
      const next = Math.min(max + 0.2, Math.max(0, raw * eased + jitter * max * 0.2));
      setValue(t >= 1 ? raw : next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setPhase("reveal");
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, raw, max]);

  function punch() {
    if (phase !== "ready") return;
    setSquash(true);
    window.setTimeout(() => setSquash(false), 220);
    setPhase("climb");
  }

  const display = value + 1;
  const angle = needleAngle(value, max);
  const tip = polar(angle, NEEDLE_LEN);
  const tail = polar(angle + 180, 14);
  const finalLabel = levels[Math.round(raw)] ?? "";
  const normalized = probabilities.map((value) => Math.max(0, value));
  const total = normalized.reduce((sum, value) => sum + value, 0) || 1;

  return (
    <div className="punch-drama">
      <p className="drama-question">{question}</p>

      <div className="punch-machine">
        <svg className="gauge" viewBox="0 0 200 160" role="img" aria-label="아날로그 게이지">
          <path d={describeArc(-SWEEP / 2, SWEEP / 2, 86)} className="gauge-track" />
          {levels.map((_, index) => {
            const a = needleAngle(index, max);
            const outer = polar(a, 86);
            const inner = polar(a, 74);
            const label = polar(a, 62);
            return (
              <g key={`tick-${index}`}>
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="gauge-tick" />
                <text x={label.x} y={label.y} className="gauge-num" textAnchor="middle" dominantBaseline="middle">{index + 1}</text>
              </g>
            );
          })}
          <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} className="gauge-needle" />
          <circle cx={CX} cy={CY} r="7" className="gauge-hub" />
        </svg>

        <div className={`digital ${phase === "reveal" ? "is-final" : ""}`} aria-live="polite">
          <span className="digital-value">{phase === "ready" ? "--.--" : display.toFixed(2)}</span>
          <span className="digital-max">/ {levels.length}</span>
        </div>

        <button
          type="button"
          className={`punch-bag ${squash ? "is-squash" : ""}`}
          onClick={punch}
          disabled={phase !== "ready"}
        >
          {phase === "ready" ? "🥊 힘껏 치기!" : phase === "climb" ? "올라가는 중..." : "결과!"}
        </button>
      </div>

      {phase === "reveal" ? (
        <div className="punch-reveal">
          <div className="drama-result">
            <span>Jev의 점수</span>
            <strong>{display.toFixed(2)} / {levels.length}</strong>
            <small>가장 가까운 단계: {finalLabel}</small>
          </div>
          <div className="level-bars">
            {levels.map((level, index) => {
              const chance = normalized[index] / total;
              return (
                <div className="level-bar-row" key={`level-${index}`}>
                  <span>{index + 1}. {level}</span>
                  <div className="probability-track"><span style={{ width: `${chance * 100}%` }} /></div>
                  <b>{Math.round(chance * 100)}%</b>
                </div>
              );
            })}
          </div>
          <div className="drama-actions">
            <button className="drama-replay" type="button" onClick={onReplay}>다시 치기 ↻</button>
            <button className="primary-button drama-next" type="button" onClick={onNext}>
              {isLast ? "결과 요약" : "다음 질문"} <span>→</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="drama-line">{phase === "ready" ? "펀치를 날려 점수를 올려 보세요." : "점수가 올라가는 중..."}</p>
      )}
    </div>
  );
}

function describeArc(startDeg: number, endDeg: number, radius: number) {
  const start = polar(startDeg, radius);
  const end = polar(endDeg, radius);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
