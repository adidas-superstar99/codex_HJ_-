import { AdminPage } from "./pages/AdminPage";
import { OrderPage } from "./pages/OrderPage";

export function App() {
  const path = window.location.pathname;

  return path.startsWith("/admin") ? <AdminPage /> : <OrderPage />;
}
