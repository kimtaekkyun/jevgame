"use client";

import { useEffect, useRef, useState } from "react";

const DURATION = 10000;
const LINES: ReadonlyArray<readonly [number, string]> = [
  [0, "동전을 던졌습니다..."],
  [2600, "공중에서는 아직 아무도 모릅니다..."],
  [6200, "Jev가 고민하는 중..."],
  [8400, "거의 결정됐어요!"],
];

type Props = {
  question: string;
  yesLabel: string;
  noLabel: string;
  isYes: boolean;
  probability: number;
  isLast: boolean;
  onNext: () => void;
  onReplay: () => void;
};

// Noul coin-flip staging. Jev's answer is already known; the animation only
// reveals it. Other primitives should get their own stage component.
export default function CoinFlip({
  question,
  yesLabel,
  noLabel,
  isYes,
  probability,
  isLast,
  onNext,
  onReplay,
}: Props) {
  const coinRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState(0);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const turns = 9 + Math.floor(Math.random() * 3);
    const finalAngle = turns * 360 + (isYes ? 0 : 180);

    const spin = coinRef.current?.animate(
      [{ transform: "rotateX(0deg)" }, { transform: `rotateX(${finalAngle}deg)` }],
      { duration: DURATION, easing: "cubic-bezier(.2,.6,.3,1)", fill: "forwards" },
    );
    const arc = arcRef.current?.animate(
      [
        { transform: "translateY(0px)", easing: "ease-out" },
        { transform: "translateY(-180px)", offset: 0.45, easing: "ease-in" },
        { transform: "translateY(0px)", offset: 0.9, easing: "ease-out" },
        { transform: "translateY(-14px)", offset: 0.95, easing: "ease-in" },
        { transform: "translateY(0px)" },
      ],
      { duration: DURATION, fill: "forwards" },
    );

    const lineTimers = LINES.map(([time], index) => window.setTimeout(() => setLine(index), time));
    const landTimer = window.setTimeout(() => setLanded(true), DURATION);

    return () => {
      spin?.cancel();
      arc?.cancel();
      lineTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(landTimer);
    };
  }, [isYes]);

  const answerLabel = isYes ? yesLabel : noLabel;

  return (
    <div className="coin-drama">
      <p className="drama-question">{question}</p>

      <div className="coin-stage">
        <div className="coin-arc" ref={arcRef}>
          <div className="coin-body" ref={coinRef}>
            <div className="coin-face coin-front">
              <b>{yesLabel}</b>
              <small>YES</small>
            </div>
            <div className="coin-face coin-back">
              <b>{noLabel}</b>
              <small>NO</small>
            </div>
          </div>
        </div>
        <div className="coin-shadow" />
      </div>

      {landed ? (
        <div className="drama-result" aria-live="polite">
          <span>Jev의 선택</span>
          <strong>{answerLabel}</strong>
          <small>확률 {Math.round(probability * 100)}%</small>
          <div className="drama-actions">
            <button className="drama-replay" type="button" onClick={onReplay}>다시 던지기 ↻</button>
            <button className="primary-button drama-next" type="button" onClick={onNext}>
              {isLast ? "결과 보기" : "다음 질문"} <span>→</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="drama-line" aria-live="polite">{LINES[line][1]}</p>
      )}
    </div>
  );
}
