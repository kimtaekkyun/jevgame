"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = { id: string; label: string; description: string };

type Props = {
  question: string;
  options: Option[];
  chosenId: string;
  probabilities: Record<string, number>;
  isLast: boolean;
  onNext: () => void;
  onReplay: () => void;
};

const ROWS = 7;
const VIEW_W = 560;
const VIEW_H = 320;
const RAIL_TOP = 26;
const RAIL_BOTTOM = 294;
const TRACE_MS = 3800;

// Rungs between column i and i+1 on each row. No two rungs touch on one row.
function makeRungs(columns: number): number[][] {
  const rows: number[][] = [];
  for (let row = 0; row < ROWS; row += 1) {
    const picked: number[] = [];
    for (let lane = 0; lane < columns - 1; lane += 1) {
      if (picked.includes(lane - 1)) continue;
      if (Math.random() < 0.45) picked.push(lane);
    }
    rows.push(picked);
  }
  return rows;
}

function railX(columns: number, index: number) {
  if (columns <= 1) return VIEW_W / 2;
  return 50 + (index * (VIEW_W - 100)) / (columns - 1);
}

function rowY(row: number) {
  return RAIL_TOP + ((row + 1) * (RAIL_BOTTOM - RAIL_TOP)) / (ROWS + 1);
}

// Walk down the ladder from `start`. Returns the points of the walk and the column it ends in.
function trace(start: number, rungs: number[][], columns: number) {
  let col = start;
  const points: { x: number; y: number }[] = [{ x: railX(columns, col), y: RAIL_TOP }];
  rungs.forEach((row, index) => {
    const y = rowY(index);
    points.push({ x: railX(columns, col), y });
    if (row.includes(col)) {
      col += 1;
    } else if (col > 0 && row.includes(col - 1)) {
      col -= 1;
    }
    points.push({ x: railX(columns, col), y });
  });
  points.push({ x: railX(columns, col), y: RAIL_BOTTOM });
  return { points, end: col };
}

function pointsToPath(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

// Put Jev's answer under the column this start reaches. Other labels fill the remaining columns randomly.
function assignLabels(options: Option[], chosenId: string, targetCol: number) {
  const chosen = options.find((option) => option.id === chosenId) ?? options[0];
  const others = options.filter((option) => option.id !== chosen.id);
  for (let i = others.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const labels: (Option | undefined)[] = Array.from({ length: options.length });
  labels[targetCol] = chosen;
  let next = 0;
  for (let col = 0; col < options.length; col += 1) {
    if (labels[col]) continue;
    labels[col] = others[next];
    next += 1;
  }
  return labels as Option[];
}

export default function LadderStage({ question, options, chosenId, probabilities, isLast, onNext, onReplay }: Props) {
  const columns = options.length;
  const [rungs] = useState(() => makeRungs(columns));
  const [start, setStart] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [arrived, setArrived] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const [token, setToken] = useState({ x: 0, y: 0 });

  const traced = useMemo(() => (start === null ? null : trace(start, rungs, columns)), [start, rungs, columns]);
  const labels = useMemo(
    () => (traced ? assignLabels(options, chosenId, traced.end) : null),
    [traced, options, chosenId],
  );
  const pathD = traced ? pointsToPath(traced.points) : "";

  useEffect(() => {
    if (start === null) return;
    let raf = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / TRACE_MS);
      setProgress(t);
      const element = pathRef.current;
      if (element) {
        const length = element.getTotalLength();
        const point = element.getPointAtLength(length * t);
        setToken({ x: point.x, y: point.y });
      }
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setArrived(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start]);

  function pick(index: number) {
    if (start !== null) return;
    setProgress(0);
    setArrived(false);
    setStart(index);
  }

  function reselect() {
    setStart(null);
    setProgress(0);
    setArrived(false);
  }

  const pathLength = 1000; // dash units; the real length comes from the path element
  const drawn = Math.max(0, Math.min(1, progress));
  const chosenPct = Math.round((probabilities[chosenId] ?? 0) * 100);

  return (
    <div className="ladder-drama">
      <p className="drama-question">{question}</p>
      <p className="ladder-hint">{start === null ? "사다리 어디에서 탈지 고르세요." : arrived ? "도착했어요!" : "사다리를 타는 중..."}</p>

      <div className="ladder-board">
        <div className="ladder-tops" aria-hidden={start !== null}>
          {Array.from({ length: columns }).map((_, index) => (
            <button
              key={`top-${index}`}
              type="button"
              className={`ladder-top ${start === index ? "is-picked" : ""}`}
              style={{ left: `${(railX(columns, index) / VIEW_W) * 100}%` }}
              onClick={() => pick(index)}
              disabled={start !== null}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <svg className="ladder-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="사다리">
          {Array.from({ length: columns }).map((_, index) => (
            <line
              key={`rail-${index}`}
              x1={railX(columns, index)}
              y1={RAIL_TOP}
              x2={railX(columns, index)}
              y2={RAIL_BOTTOM}
              className="ladder-rail"
            />
          ))}
          {rungs.map((row, rowIndex) =>
            row.map((lane) => (
              <line
                key={`rung-${rowIndex}-${lane}`}
                x1={railX(columns, lane)}
                y1={rowY(rowIndex)}
                x2={railX(columns, lane + 1)}
                y2={rowY(rowIndex)}
                className="ladder-rung"
              />
            )),
          )}
          {traced && (
            <>
              <path ref={pathRef} d={pathD} className="ladder-trace-base" />
              <path
                d={pathD}
                className="ladder-trace"
                pathLength={pathLength}
                style={{ strokeDasharray: pathLength, strokeDashoffset: pathLength * (1 - drawn) }}
              />
              <circle cx={token.x} cy={token.y} r="9" className="ladder-token" />
            </>
          )}
        </svg>

        <div className="ladder-bottoms">
          {Array.from({ length: columns }).map((_, index) => {
            const label = labels?.[index];
            const revealed = arrived && label;
            const isArrival = arrived && traced?.end === index;
            return (
              <div
                key={`bottom-${index}`}
                className={`ladder-bottom ${isArrival ? "is-arrival" : ""}`}
                style={{ left: `${(railX(columns, index) / VIEW_W) * 100}%` }}
              >
                {revealed ? (
                  <>
                    <b>{label.label}</b>
                    <span>{Math.round((probabilities[label.id] ?? 0) * 100)}%</span>
                  </>
                ) : (
                  <b className="ladder-hidden">?</b>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {arrived && traced && labels ? (
        <div className="drama-result" aria-live="polite">
          <span>Jev의 선택</span>
          <strong>{labels[traced.end]?.label}</strong>
          <small>확률 {chosenPct}%</small>
          <div className="drama-actions">
            <button className="text-button ladder-reselect" type="button" onClick={reselect}>다른 자리에서 타기</button>
            <button className="drama-replay" type="button" onClick={onReplay}>다시 굴리기 ↻</button>
            <button className="primary-button drama-next" type="button" onClick={onNext}>
              {isLast ? "결과 요약" : "다음 질문"} <span>→</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="drama-line">{start === null ? "위의 번호 중 하나를 누르면 사다리가 내려갑니다." : "사다리를 따라 내려가는 중..."}</p>
      )}
    </div>
  );
}
