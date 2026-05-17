import { useEffect, useState } from "react";
import { fetchPublicBatches } from "../api";
import type { OrderBatch } from "../types";

export function BatchListPage() {
  const [batches, setBatches] = useState<OrderBatch[]>([]);
  const [message, setMessage] = useState("목록을 불러오는 중입니다.");

  useEffect(() => {
    fetchPublicBatches()
      .then((rows) => {
        setBatches(rows);
        setMessage(rows.length ? "" : "현재 주문 가능한 주문 목록이 없습니다.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "주문 목록을 불러오지 못했습니다."));
  }, []);

  return (
    <main>
      <div className="top">
        <div>
          <div className="brand-lockup">
            <img className="brand-logo" src="/logo-samoo.png" alt="SAMOO AX" />
            <div className="eyebrow">SAMOO AX Beverage Order</div>
          </div>
          <h1>주문 목록</h1>
          <p className="muted">관리자가 만든 주문 제목을 선택하고 해당 목록 안에서 음료를 주문해 주세요.</p>
        </div>
        <a href="/admin">관리자</a>
      </div>

      <section className="hero-card">
        <div className="hero-content">
          <div className="hero-pills">
            <span>빠른 진입</span>
            <span>모바일 대응</span>
            <span>실시간 목록 확인</span>
          </div>
          <h2>지금 열려 있는 주문만 바로 모아서 확인하세요.</h2>
          <p className="hero-copy">
            목록을 하나 고르면 같은 화면 안에서 주문, 수정, 취소까지 이어서 처리할 수 있게 구성했습니다.
          </p>
        </div>
      </section>

      {batches.length ? (
        <div className="batch-grid">
          {batches.map((batch) => (
            <article className="batch-card" key={batch.id}>
              <div className="batch-card-badges">
                <span className="badge">{batch.status === "open" ? "주문 가능" : "마감"}</span>
                <span className="dept-badge">{batch.department || "AX팀"}</span>
              </div>
              <h2>{batch.title}</h2>
              <p className="muted">생성: {new Date(batch.createdAt).toLocaleString("ko-KR")}</p>
              {batch.memo ? <p>{batch.memo}</p> : null}
              <a className="primary" href={`/order/${batch.id}`}>이 주문 목록에서 주문하기</a>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">{message}</div>
      )}
    </main>
  );
}
