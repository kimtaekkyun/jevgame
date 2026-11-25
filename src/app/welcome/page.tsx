import { cookies } from "next/headers";
import AccessForm from "./access-form";
import { isAccessConfigured } from "@/lib/access";

export default async function WelcomePage() {
  await cookies();
  return (
    <main className="welcome-screen">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="welcome-brand">
          <span className="brand-mark">객</span>
          <span>인생은 객관식</span>
        </div>

        <div className="welcome-orbit" aria-hidden="true">
          <span className="welcome-choice">Choice</span>
          <span className="welcome-noul">Noul</span>
          <span className="welcome-score">Score</span>
          <span className="welcome-core">객</span>
          <span className="welcome-box">Box</span>
        </div>

        <p className="welcome-eyebrow">A LITTLE ROOM FOR BIG CHOICES</p>
        <h1 id="welcome-title">인생은<br /><span>객관식</span></h1>
        <p className="welcome-copy">Jev가 고른 답을 함께 들여다보는 곳.<br />초대 코드를 입력하고 입장해 주세요.</p>
        <AccessForm configured={isAccessConfigured()} />
        <p className="welcome-footnote">이 공간은 초대받은 사람만 이용할 수 있습니다.</p>
      </section>
      <footer className="welcome-footer">답은 Jev가, 책임은 당신이.</footer>
    </main>
  );
}
