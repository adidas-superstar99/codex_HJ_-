import type { SummaryRow } from "../types";

export function OrderSummaryTable({ rows }: { rows: SummaryRow[] }) {
  if (!rows.length) return <div className="empty-state">집계할 주문이 없습니다.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>브랜드</th>
            <th>카테고리</th>
            <th>메뉴</th>
            <th>사이즈</th>
            <th>수량</th>
            <th>요청사항</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.brand}-${row.category}-${row.menuName}-${row.size}`}>
              <td>{row.brand}</td>
              <td>{row.category}</td>
              <td>{row.menuName}</td>
              <td>{row.size}</td>
              <td>{row.quantity}</td>
              <td>
                {row.requests.length
                  ? row.requests.map((request) => `${request.ordererName}: ${request.customRequest}`).join(" / ")
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
