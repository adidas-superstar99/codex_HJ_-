import { ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createOrder, fetchMenus } from "../api";
import { BrandTabs } from "../components/BrandTabs";
import { CustomRequestInput } from "../components/CustomRequestInput";
import { MenuGrid } from "../components/MenuGrid";
import { OrderCart } from "../components/OrderCart";
import { SizeSelector } from "../components/SizeSelector";
import type { Brand, CartItem, Menu } from "../types";

export function OrderPage() {
  const [brand, setBrand] = useState<Brand>("STARBUCKS");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [customRequest, setCustomRequest] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState({ ordererName: "", team: "", contact: "", memo: "" });
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchMenus({ brand })
      .then(setMenus)
      .catch((error) => setStatusMessage(error.message));
  }, [brand]);

  const categories = useMemo(() => ["ALL", ...new Set(menus.map((menu) => menu.category))], [menus]);
  const visibleMenus = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return menus.filter((menu) => {
      if (category !== "ALL" && menu.category !== category) return false;
      if (normalized && !menu.name.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [category, menus, query]);

  function openMenu(menu: Menu) {
    setSelectedMenu(menu);
    setSelectedSize(menu.availableSizes[0] ?? "");
    setQuantity(1);
    setCustomRequest("");
  }

  function addToCart() {
    if (!selectedMenu || !selectedSize) return;
    setCart((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        brand: selectedMenu.brand,
        menuId: selectedMenu.id,
        menuName: selectedMenu.name,
        category: selectedMenu.category,
        size: selectedSize,
        quantity,
        customRequest: customRequest.trim() || undefined
      }
    ]);
    setSelectedMenu(null);
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    setStatusMessage("");

    if (!form.ordererName.trim()) {
      setStatusMessage("주문자 이름을 입력해 주세요.");
      return;
    }

    if (!cart.length) {
      setStatusMessage("장바구니에 음료를 담아 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrder({ ...form, items: cart });
      setCart([]);
      setForm({ ordererName: "", team: "", contact: "", memo: "" });
      setStatusMessage("주문이 제출되었습니다.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "주문 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="order-header">
        <div>
          <p className="eyebrow">Beverage order</p>
          <h1>음료 주문 취합</h1>
          <p>브랜드와 메뉴를 골라 장바구니에 담고 한 번에 제출하세요.</p>
        </div>
        <a className="admin-link" href="/admin">관리자</a>
      </section>

      <form className="layout" onSubmit={submitOrder}>
        <section className="main-panel">
          <div className="toolbar">
            <BrandTabs value={brand} onChange={(nextBrand) => {
              setBrand(nextBrand);
              setCategory("ALL");
            }} />
            <div className="filters">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="메뉴명 검색" />
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item === "ALL" ? "전체 카테고리" : item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <MenuGrid menus={visibleMenus} onSelect={openMenu} />
        </section>

        <aside className="side-panel">
          <div className="panel-section">
            <h2>주문자 정보</h2>
            <label className="field">
              <span>이름 *</span>
              <input value={form.ordererName} onChange={(event) => setForm({ ...form, ordererName: event.target.value })} />
            </label>
            <label className="field">
              <span>팀</span>
              <input value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })} />
            </label>
            <label className="field">
              <span>연락처 또는 메신저 ID</span>
              <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
            </label>
            <label className="field">
              <span>수령 메모</span>
              <input value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
            </label>
          </div>

          <div className="panel-section">
            <h2>장바구니</h2>
            <OrderCart
              items={cart}
              onRemove={(localId) => setCart((current) => current.filter((item) => item.localId !== localId))}
              onQuantityChange={(localId, nextQuantity) =>
                setCart((current) =>
                  nextQuantity < 1
                    ? current.filter((item) => item.localId !== localId)
                    : current.map((item) => (item.localId === localId ? { ...item, quantity: nextQuantity } : item))
                )
              }
            />
          </div>

          {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            <ShoppingBag size={18} />
            {isSubmitting ? "제출 중" : "주문 제출"}
          </button>
        </aside>
      </form>

      {selectedMenu ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="menu-modal-title">
            <button className="close-button" type="button" aria-label="닫기" onClick={() => setSelectedMenu(null)}>
              <X size={20} />
            </button>
            <img src={selectedMenu.imageUrl} alt="" />
            <h2 id="menu-modal-title">{selectedMenu.name}</h2>
            <p>{selectedMenu.category}</p>
            <SizeSelector sizes={selectedMenu.availableSizes} value={selectedSize} onChange={setSelectedSize} />
            <label className="field">
              <span>수량</span>
              <input min={1} type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <CustomRequestInput value={customRequest} onChange={setCustomRequest} />
            <button className="primary-button" type="button" onClick={addToCart}>
              <ShoppingBag size={18} />
              장바구니 담기
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
