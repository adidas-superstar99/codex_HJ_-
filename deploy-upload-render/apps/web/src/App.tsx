import { AdminPage } from "./pages/AdminPage";
import { BatchListPage } from "./pages/BatchListPage";
import { OrderPage } from "./pages/OrderPage";

export function App() {
  const path = window.location.pathname;
  const orderMatch = path.match(/^\/order\/([^/]+)$/);

  if (path === "/admin") {
    return <AdminPage />;
  }

  if (orderMatch) {
    return <OrderPage batchId={decodeURIComponent(orderMatch[1])} />;
  }

  return <BatchListPage />;
}
