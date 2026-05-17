import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  adminHeaders,
  bulkUpdateStatus,
  createBatch,
  deleteAdminOrder,
  deleteBatch,
  exportCsvUrl,
  fetchAdminBatches,
  fetchAdminOrders,
  fetchSummary,
  updateBatch,
  updateStatus
} from "../api";
import type { Brand, Order, OrderBatch, OrderStatus, SummaryRow } from "../types";

const brandLabels: Record<Brand, string> = {
  STARBUCKS: "스타벅스",
  TWOSOME: "투썸플레이스"
};

const statusLabels: Record<OrderStatus, string> = {
  submitted: "주문 접수",
  confirmed: "주문 확정",
  ordered: "매장 주문 완료",
  completed: "수령 완료",
  cancelled: "취소"
};

const orderedStatuses: OrderStatus[] = ["submitted", "confirmed", "ordered", "completed", "cancelled"];

export function AdminPage() {
  const [password, setPassword] = useState(() => window.localStorage.getItem("adminPassword") ?? "");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [batches, setBatches] = useState<OrderBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [brand, setBrand] = useState<Brand | "ALL">("ALL");
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ title: "", department: "AX팀", memo: "" });

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  useEffect(() => {
    if (!isUnlocked || !selectedBatchId) return;
    void loadOrders();
  }, [isUnlocked, selectedBatchId, brand]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    try {
      window.localStorage.setItem("adminPassword", password);
      const nextBatches = await fetchAdminBatches(password);
      setBatches(nextBatches);
      setSelectedBatchId(nextBatches[0]?.id || "");
      setIsUnlocked(true);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "관리자 접속에 실패했습니다.");
      setIsUnlocked(false);
    }
  }

  async function loadBatches(nextSelectedBatchId?: string) {
    const nextBatches = await fetchAdminBatches(password);
    setBatches(nextBatches);
    const preferred = nextSelectedBatchId || selectedBatchId;
    if (preferred && nextBatches.some((batch) => batch.id === preferred)) {
      setSelectedBatchId(preferred);
    } else {
      setSelectedBatchId(nextBatches[0]?.id || "");
    }
  }

  async function loadOrders() {
    if (!selectedBatchId) {
      setOrders([]);
      setSummary([]);
      return;
    }

    try {
      const params = { batchId: selectedBatchId, brand };
      const [nextOrders, nextSummary] = await Promise.all([
        fetchAdminOrders(password, params),
        fetchSummary(password, params)
      ]);
      setOrders(nextOrders);
      setSummary(nextSummary);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "관리자 데이터를 불러오지 못했습니다.");
    }
  }

  async function handleCreateBatch() {
    if (!draft.title.trim()) {
      setMessage("제목을 입력해 주세요.");
      return;
    }

    try {
      const batch = await createBatch(password, {
        title: draft.title.trim(),
        department: draft.department.trim() || "AX팀",
        memo: draft.memo.trim() || undefined
      });
      setDraft({ title: "", department: "AX팀", memo: "" });
      await loadBatches(batch.id);
      setMessage("주문 목록을 생성했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 목록 생성에 실패했습니다.");
    }
  }

  async function handleToggleBatch(batch: OrderBatch) {
    try {
      await updateBatch(password, batch.id, { status: batch.status === "open" ? "closed" : "open" });
      await loadBatches(batch.id);
      await loadOrders();
      setMessage(batch.status === "open" ? "주문 목록을 마감했습니다." : "주문 목록을 다시 열었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 목록 변경에 실패했습니다.");
    }
  }

  async function handleDeleteBatch(batch: OrderBatch) {
    if (!window.confirm(`"${batch.title}" 주문 목록을 삭제할까요? 이 안의 주문도 함께 삭제됩니다.`)) return;

    try {
      await deleteBatch(password, batch.id);
      await loadBatches();
      setMessage("주문 목록을 삭제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 목록 삭제에 실패했습니다.");
    }
  }

  async function handleChangeStatus(orderId: string, status: OrderStatus) {
    try {
      await updateStatus(password, orderId, status);
      await loadOrders();
      setMessage(`주문 상태를 ${statusLabels[status]}로 변경했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 상태 변경에 실패했습니다.");
    }
  }

  async function handleBulkStatus(status: OrderStatus) {
    if (!selectedBatchId) return;

    try {
      const result = await bulkUpdateStatus(password, status, { batchId: selectedBatchId, brand });
      await loadOrders();
      setMessage(`${result.updatedCount}건을 ${statusLabels[status]}로 변경했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "일괄 상태 변경에 실패했습니다.");
    }
  }

  async function handleDeleteOrder(orderId: string) {
    if (!window.confirm("이 주문을 삭제할까요?")) return;

    try {
      await deleteAdminOrder(password, orderId);
      await loadBatches(selectedBatchId);
      await loadOrders();
      setMessage("주문을 삭제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 삭제에 실패했습니다.");
    }
  }

  async function handleCsv() {
    try {
      const response = await fetch(exportCsvUrl({ batchId: selectedBatchId, brand }), { headers: adminHeaders(password) });
      if (!response.ok) throw new Error("CSV 다운로드에 실패했습니다.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "orders.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV 다운로드에 실패했습니다.");
    }
  }

  const totalCups = orders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
    0
  );
  const peopleCount = new Set(orders.map((order) => order.ordererName)).size;

  if (!isUnlocked) {
    return (
      <div className="login">
        <div className="brand-lockup">
          <img className="brand-logo" src="/logo-samoo.png" alt="SAMOO AX" />
          <div className="eyebrow">ADMIN</div>
        </div>
        <h1>관리자 주문 취합</h1>
        <form className="grid" onSubmit={unlock}>
          <label>
            <span>관리자 비밀번호</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {message ? <p className="message">{message}</p> : null}
          <button className="primary" type="submit">입장</button>
          <p><a href="/">주문 목록으로</a></p>
        </form>
      </div>
    );
  }

  return (
    <main>
      <div className="top">
        <div>
          <div className="brand-lockup">
            <img className="brand-logo" src="/logo-samoo.png" alt="SAMOO AX" />
            <div className="eyebrow">SAMOO AX Beverage Order</div>
          </div>
          <h1>주문 목록 관리</h1>
          <p className="muted">주문 목록을 만들고 실제 매장 주문과 수령 완료 시점까지 이 화면에서 직접 관리합니다.</p>
        </div>
        <a href="/">주문 목록</a>
      </div>

      <section className="hero-card">
        <div className="hero-content">
          <div className="hero-pills">
            <span>실시간 집계</span>
            <span>상태 일괄 처리</span>
            <span>CSV 내보내기</span>
          </div>
          <h2>주문 확정부터 수령 완료까지 한 화면에서 관리하세요.</h2>
          <p className="hero-copy">브랜드 필터, 주문 상태 변경, 메뉴별 집계, 전체 매장 주문 완료 처리까지 한 번에 담았습니다.</p>
        </div>
      </section>

      <div className="admin-grid">
        <section className="panel">
          <h2>새 주문 목록 생성</h2>
          <label>
            <span>제목 *</span>
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            <span>대상 부서</span>
            <input value={draft.department} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))} />
          </label>
          <label>
            <span>메모</span>
            <textarea rows={3} value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} />
          </label>
          <button className="primary" type="button" onClick={() => void handleCreateBatch()}>주문 목록 생성</button>
          <hr />
          <h2>주문 목록</h2>
          <div className="grid">
            {batches.length ? (
              batches.map((batch) => (
                <article className={`batch-card ${batch.id === selectedBatchId ? "selected-batch" : ""}`} key={batch.id}>
                  <div className="batch-card-badges">
                    <span className="badge">{batch.status === "open" ? "진행 중" : "마감"}</span>
                    <span className="dept-badge">{batch.department || "AX팀"}</span>
                  </div>
                  <h2>{batch.title}</h2>
                  <p className="muted">{new Date(batch.createdAt).toLocaleString("ko-KR")}</p>
                  <p><strong>주문 {batch.orderCount || 0}건 · 음료 {batch.cupCount || 0}잔</strong></p>
                  {batch.memo ? <p>{batch.memo}</p> : null}
                  <button className="secondary" type="button" onClick={() => setSelectedBatchId(batch.id)}>이 주문 목록 보기</button>
                  <button className={batch.status === "open" ? "danger" : "primary"} type="button" onClick={() => void handleToggleBatch(batch)}>
                    {batch.status === "open" ? "마감" : "다시 열기"}
                  </button>
                  <button className="danger" type="button" onClick={() => void handleDeleteBatch(batch)}>주문 목록 삭제</button>
                  <a href={`/order/${batch.id}`} target="_blank" rel="noreferrer">주문 링크 열기</a>
                </article>
              ))
            ) : (
              <div className="empty">아직 주문 목록이 없습니다.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>{selectedBatch ? selectedBatch.title : "주문 목록을 먼저 선택해 주세요."}</h2>
          {selectedBatch ? <p className="selected-note">{selectedBatch.department || "AX팀"} · {selectedBatch.memo || "메모 없음"}</p> : null}

          <div className="toolbar">
            <label>
              <span>브랜드</span>
              <select value={brand} onChange={(event) => setBrand(event.target.value as Brand | "ALL")}>
                <option value="ALL">전체</option>
                <option value="STARBUCKS">스타벅스</option>
                <option value="TWOSOME">투썸플레이스</option>
              </select>
            </label>
            <div className="toolbar-actions">
              <button className="soft-action" type="button" onClick={() => void handleBulkStatus("confirmed")}>전체 주문 확정</button>
              <button className="soft-action" type="button" onClick={() => void handleBulkStatus("ordered")}>전체 매장 주문 완료</button>
              <button className="soft-action" type="button" onClick={() => void handleBulkStatus("completed")}>전체 수령 완료</button>
              <button className="soft-action" type="button" onClick={() => void loadOrders()}>새로고침</button>
              <button className="soft-action csv-action" type="button" onClick={() => void handleCsv()}>CSV 내려받기</button>
            </div>
          </div>

          {message ? <p className="message">{message}</p> : null}

          <div className="stats">
            <span className="stat">주문 {orders.length}건</span>
            <span className="stat">주문자 {peopleCount}명</span>
            <span className="stat">음료 {totalCups}잔</span>
          </div>

          <h3>메뉴별 집계</h3>
          {summary.length ? (
            <div className="summary-groups">
              {Object.entries(
                summary.reduce<Record<string, SummaryRow[]>>((accumulator, row) => {
                  const key = row.brand;
                  accumulator[key] = [...(accumulator[key] || []), row];
                  return accumulator;
                }, {})
              ).map(([groupBrand, rows]) => {
                const brandKey = groupBrand as Brand;
                const cups = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
                return (
                  <section className="summary-group" key={groupBrand}>
                    <div className="summary-group-header">
                      <h4>{brandLabels[brandKey]}</h4>
                      <span className="summary-group-count">{rows.length}개 메뉴 · {cups}잔</span>
                    </div>
                    <div className="summary-list">
                      {rows.map((row) => (
                        <div className="summary-row" key={`${row.brand}-${row.category}-${row.menuName}-${row.size}`}>
                          <div className="summary-menu">{row.menuName}</div>
                          <div className="summary-size">{row.size}</div>
                          <div className="summary-qty">{row.quantity}잔</div>
                          <div className={row.requests.length ? "summary-request" : "summary-request is-empty"}>
                            {row.requests.length ? row.requests.map((request) => `${request.ordererName}: ${request.customRequest}`).join(" / ") : "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="empty">집계할 주문이 없습니다.</div>
          )}

          <h3>주문 목록</h3>
          <div>
            {orders.length ? (
              orders.map((order) => (
                <article className="order" key={order.id}>
                  <header>
                    <div>
                      <strong>{order.ordererName}</strong>
                      <div>{new Date(order.orderedAt).toLocaleString("ko-KR")}</div>
                    </div>
                    <div className="order-admin-actions">
                      <select value={order.status} onChange={(event) => void handleChangeStatus(order.id, event.target.value as OrderStatus)}>
                        {orderedStatuses.map((status) => (
                          <option key={status} value={status}>{statusLabels[status]}</option>
                        ))}
                      </select>
                      <button className="danger" type="button" onClick={() => void handleDeleteOrder(order.id)}>삭제</button>
                    </div>
                  </header>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {brandLabels[item.brand]} · {item.menuName} · {item.size} · {item.quantity}잔
                        {item.customRequest ? <em>{item.customRequest}</em> : null}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            ) : (
              <div className="empty">조회된 주문이 없습니다.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
