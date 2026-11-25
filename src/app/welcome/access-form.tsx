"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AccessForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || isSubmitting) return;

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "입장할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      router.replace("/");
    } catch {
      setError("서버에 연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="welcome-form" onSubmit={submit}>
      <label className="welcome-label" htmlFor="entry-code">ENTRY CODE</label>
      <div className="welcome-input-wrap">
        <span aria-hidden="true">✳</span>
        <input
          id="entry-code"
          type="password"
          autoComplete="one-time-code"
          placeholder="초대 코드를 입력하세요"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={256}
          disabled={!configured || isSubmitting}
          aria-describedby="entry-message"
          required
        />
      </div>
      {!configured ? (
        <p className="welcome-error" id="entry-message" role="alert">
          입장 기능이 아직 설정되지 않았습니다. 운영자에게 문의해 주세요.
        </p>
      ) : (
        <p className={`welcome-message ${error ? "is-error" : ""}`} id="entry-message" aria-live="polite">
          {error || "코드는 화면에 표시되지 않으며 안전하게 확인됩니다."}
        </p>
      )}
      <button className="welcome-submit" type="submit" disabled={!configured || isSubmitting || !code.trim()}>
        {isSubmitting ? "확인 중..." : <>입장하기 <span aria-hidden="true">→</span></>}
      </button>
    </form>
  );
}
