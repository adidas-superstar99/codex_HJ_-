import { Download, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { adminHeaders, exportCsvUrl, fetchAdminOrders, fetchSummary, updateStatus } from "../api";
import { OrderSummaryTable } from "../components/OrderSummaryTable";
import type { Brand, Order, OrderStatus, SummaryRow } from "../types";

const statuses: Array<OrderStatus | "ALL"> = ["ALL", "submitted", "confirmed", "ordered", "completed", "cancelled"];
const brands: Array<Brand | "ALL"> = ["ALL", "STARBUCKS", "TWOSOME"];

export function AdminPage() {
  const [password, setPassword] = useState(() => window.localStorage.getItem("adminPassword") ?? "");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [brand, setBrand] = useState<Brand | "ALL">("ALL");
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isUnlocked) void load();
  }, [isUnlocked, date, brand, status]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    window.localStorage.setItem("adminPassword", password);
    setIsUnlocked(true);
  }

  async function load() {
    setMessage("");
    try {
      const params = { date, brand, status };
      const [nextOrders, nextSummary] = await Promise.all([fetchAdminOrders(password, params), fetchSummary(password, params)]);
      setOrders(nextOrders);
      setSummary(nextSummary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "관리자 데이터를 불러오지 못했습니다.");
      setIsUnlocked(false);
    }
  }

  async function changeStatus(orderId: string, nextStatus: OrderStatus) {
    try {
      await updateStatus(password, orderId, nextStatus);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상태 변경에 실패했습니다.");
    }
  }

  async function downloadCsv() {
    const response = await fetch(exportCsvUrl({ date, brand, status }), { headers: adminHeaders(password) });
    if (!response.ok) {
      setMessage("CSV 다운로드에 실패했습니다.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders-${date || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!isUnlocked) {
    return (
      <main className="admin-login">
        <form onSubmit={unlock}>
          <p className="eyebrow">Admin</p>
          <h1>관리자 주문 취합</h1>
          <label className="field">
            <span>관리자 비밀번호</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {message ? <p className="status-message">{message}</p> : null}
          <button className="primary-button" type="submit">입장</button>
          <a className="text-link" href="/">주문 화면으로</a>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="order-header">
        <div>
          <p className="eyebrow">Admin dashboard</p>
          <h1>주문 취합 현황</h1>
          <p>날짜, 브랜드, 상태 기준으로 주문과 집계를 확인합니다.</p>
        </div>
        <a className="admin-link" href="/">주문 화면</a>
      </section>

      <section className="admin-toolbar">
        <label className="field compact">
          <span>날짜</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field compact">
          <span>브랜드</span>
          <select value={brand} onChange={(event) => setBrand(event.target.value as Brand | "ALL")}>
            {brands.map((item) => (
              <option key={item} value={item}>{item === "ALL" ? "전체" : item}</option>
            ))}
          </select>
        </label>
        <label className="field compact">
          <span>상태</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "ALL")}>
            {statuses.map((item) => (
              <option key={item} value={item}>{item === "ALL" ? "전체" : item}</option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={load}>
          <RefreshCcw size={17} />
          새로고침
        </button>
        <button className="secondary-button" type="button" onClick={downloadCsv}>
          <Download size={17} />
          CSV
        </button>
      </section>

      {message ? <p className="status-message">{message}</p> : null}

      <section className="dashboard-grid">
        <div className="dashboard-section">
          <h2>메뉴별 집계</h2>
          <OrderSummaryTable rows={summary} />
        </div>

        <div className="dashboard-section">
          <h2>주문 목록</h2>
          <div className="order-list">
            {orders.length ? orders.map((order) => (
              <article className="order-row" key={order.id}>
                <header>
                  <div>
                    <strong>{order.ordererName}</strong>
                    <span>{new Date(order.orderedAt).toLocaleString("ko-KR")}</span>
                  </div>
                  <select value={order.status} onChange={(event) => changeStatus(order.id, event.target.value as OrderStatus)}>
                    {statuses.filter((item) => item !== "ALL").map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </header>
                <dl>
                  <div><dt>팀</dt><dd>{order.team || "-"}</dd></div>
                  <div><dt>연락처</dt><dd>{order.contact || "-"}</dd></div>
                  <div><dt>메모</dt><dd>{order.memo || "-"}</dd></div>
                </dl>
                <ul>
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.brand} · {item.menuName} · {item.size} · {item.quantity}잔
                      {item.customRequest ? <em>{item.customRequest}</em> : null}
                    </li>
                  ))}
                </ul>
              </article>
            )) : <div className="empty-state">조회된 주문이 없습니다.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
