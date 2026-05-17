import { ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  cancelOwnOrder,
  createOrder,
  fetchBatch,
  fetchBatchOrders,
  fetchMenus,
  fetchPopularMenus,
  updateOrder
} from "../api";
import type { Brand, CartItem, Menu, Order, OrderBatch, PopularMenu } from "../types";

const recentOrderKey = "samoo-beverage-recent-order-v1";

const brandLabels: Record<Brand, string> = {
  STARBUCKS: "스타벅스",
  TWOSOME: "투썸플레이스"
};

function categoryLabel(value: string) {
  if (value === "ALL") return "전체 메뉴";
  if (value === "POPULAR") return "이번 주문 인기";
  if (value === "NEW") return "신메뉴";
  return value;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    submitted: "주문 접수",
    confirmed: "주문 확정",
    ordered: "매장 주문 완료",
    completed: "수령 완료",
    cancelled: "취소"
  };
  return labels[value] || value;
}

type SavedOrder = {
  ordererName: string;
  items: Array<Omit<CartItem, "localId">>;
  savedAt: string;
};

export function OrderPage({ batchId }: { batchId: string }) {
  const [batch, setBatch] = useState<OrderBatch | null>(null);
  const [brand, setBrand] = useState<Brand>("STARBUCKS");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [popularRows, setPopularRows] = useState<PopularMenu[]>([]);
  const [publicOrders, setPublicOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [customRequest, setCustomRequest] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ordererName, setOrdererName] = useState("");
  const [editingOrderId, setEditingOrderId] = useState("");
  const [message, setMessage] = useState("주문 정보를 불러오는 중입니다.");

  useEffect(() => {
    void loadBatch();
  }, [batchId]);

  useEffect(() => {
    if (!batch || batch.status !== "open") return;
    void loadMenus();
  }, [batch, brand]);

  const categories = useMemo(() => {
    const menuCategories = [...new Set(menus.map((menu) => menu.category))];
    return ["ALL", ...(popularRows.length ? ["POPULAR"] : []), ...(menus.some((menu) => menu.isNew) ? ["NEW"] : []), ...menuCategories];
  }, [menus, popularRows]);

  useEffect(() => {
    if (!categories.includes(category)) {
      setCategory("ALL");
    }
  }, [categories, category]);

  const popularMenuIds = useMemo(() => new Set(popularRows.map((row) => row.menuId)), [popularRows]);
  const filteredMenus = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return menus.filter((menu) => {
      const matchesCategory =
        category === "ALL" ||
        (category === "NEW" ? menu.isNew === true : category === "POPULAR" ? popularMenuIds.has(menu.id) : menu.category === category);
      const matchesQuery = !normalizedQuery || menu.name.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, menus, popularMenuIds, query]);

  const menuGroups = useMemo(() => {
    const groups = new Map<string, Menu[]>();

    if (category === "ALL") {
      const popularMenus = filteredMenus.filter((menu) => popularMenuIds.has(menu.id));
      if (popularMenus.length) groups.set("POPULAR", popularMenus);

      const newMenus = filteredMenus.filter((menu) => menu.isNew === true);
      if (newMenus.length) groups.set("NEW", newMenus);

      filteredMenus.forEach((menu) => {
        if (popularMenuIds.has(menu.id) || menu.isNew) return;
        const key = menu.category;
        groups.set(key, [...(groups.get(key) || []), menu]);
      });
      return groups;
    }

    filteredMenus.forEach((menu) => {
      const key = category === "POPULAR" || category === "NEW" ? category : menu.category;
      groups.set(key, [...(groups.get(key) || []), menu]);
    });
    return groups;
  }, [category, filteredMenus, popularMenuIds]);

  async function loadBatch() {
    try {
      const [nextBatch, nextOrders] = await Promise.all([fetchBatch(batchId), fetchBatchOrders(batchId)]);
      setBatch(nextBatch);
      setPublicOrders(nextOrders);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 목록을 불러오지 못했습니다.");
    }
  }

  async function loadMenus() {
    try {
      const [nextMenus, nextPopularRows] = await Promise.all([
        fetchMenus({ brand }),
        fetchPopularMenus({ batchId, brand, limit: 3 })
      ]);
      setMenus(nextMenus);
      setPopularRows(nextPopularRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메뉴를 불러오지 못했습니다.");
    }
  }

  async function refreshPublicOrders() {
    try {
      setPublicOrders(await fetchBatchOrders(batchId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 목록을 새로고침하지 못했습니다.");
    }
  }

  function openMenu(menu: Menu) {
    setSelectedMenu(menu);
    setSelectedSize(menu.availableSizes[0] || "");
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
    setMessage("");
  }

  function getSavedOrder(): SavedOrder | null {
    try {
      const saved = JSON.parse(window.localStorage.getItem(recentOrderKey) || "null") as SavedOrder | null;
      if (!saved || !Array.isArray(saved.items)) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function saveRecentOrder(name: string, items: CartItem[]) {
    const payload: SavedOrder = {
      ordererName: name,
      items: items.map(({ localId: _localId, ...item }) => item),
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(recentOrderKey, JSON.stringify(payload));
  }

  function applyRecentOrder() {
    const saved = getSavedOrder();
    if (!saved?.items.length) return;
    if (saved.ordererName && !ordererName.trim()) setOrdererName(saved.ordererName);
    setCart(saved.items.map((item) => ({ ...item, localId: crypto.randomUUID() })));
    setMessage("최근 주문을 장바구니에 다시 담았습니다.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ordererName.trim()) {
      setMessage("이름을 입력해 주세요.");
      return;
    }

    if (!cart.length) {
      setMessage("장바구니에 메뉴를 담아 주세요.");
      return;
    }

    const payload = {
      batchId,
      ordererName: ordererName.trim(),
      items: cart.map(({ localId: _localId, ...item }) => item)
    };

    try {
      if (editingOrderId) {
        await updateOrder(editingOrderId, payload);
      } else {
        await createOrder(payload);
      }
      saveRecentOrder(ordererName.trim(), cart);
      setCart([]);
      setEditingOrderId("");
      setMessage(editingOrderId ? "주문을 수정했습니다." : "주문을 제출했습니다.");
      await refreshPublicOrders();
      await loadMenus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 저장에 실패했습니다.");
    }
  }

  function startEdit(order: Order) {
    if (order.ordererName !== ordererName.trim()) {
      setMessage("이름이 일치하는 내 주문만 수정할 수 있습니다.");
      return;
    }
    setEditingOrderId(order.id);
    setCart(order.items.map((item) => ({ ...item, localId: crypto.randomUUID() })));
    setMessage("장바구니를 수정한 뒤 주문 수정 버튼을 눌러 주세요.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCancel(orderId: string) {
    if (!ordererName.trim()) {
      setMessage("취소하려면 먼저 이름을 입력해 주세요.");
      return;
    }
    if (!window.confirm("내 주문을 취소할까요?")) return;

    try {
      await cancelOwnOrder(orderId, ordererName.trim());
      if (editingOrderId === orderId) {
        setEditingOrderId("");
        setCart([]);
      }
      setMessage("주문을 취소했습니다.");
      await refreshPublicOrders();
      await loadMenus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주문 취소에 실패했습니다.");
    }
  }

  function updateQuantity(localId: string, nextQuantity: number) {
    setCart((current) =>
      nextQuantity < 1
        ? current.filter((item) => item.localId !== localId)
        : current.map((item) => (item.localId === localId ? { ...item, quantity: nextQuantity } : item))
    );
  }

  const savedOrder = getSavedOrder();
  const totalCups = publicOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
    0
  );
  const totalPeople = new Set(publicOrders.map((order) => order.ordererName)).size;

  if (!batch) {
    return (
      <main>
        <div className="empty">{message}</div>
      </main>
    );
  }

  if (batch.status !== "open") {
    return (
      <main>
        <div className="top">
          <div>
            <div className="brand-lockup">
              <img className="brand-logo" src="/assets/logo-samoo.png" alt="SAMOO AX" />
              <div className="eyebrow">SAMOO AX Beverage Order</div>
            </div>
            <h1>{batch.title}</h1>
          </div>
          <div><a href="/">주문 목록</a> · <a href="/admin">관리자</a></div>
        </div>
        <div className="empty">마감된 주문 목록입니다. 관리자에게 다시 열어 달라고 요청해 주세요.</div>
      </main>
    );
  }

  return (
    <main>
      <div className="top">
        <div>
          <div className="brand-lockup">
            <img className="brand-logo" src="/assets/logo-samoo.png" alt="SAMOO AX" />
            <div className="eyebrow">SAMOO AX Beverage Order</div>
          </div>
          <h1>{batch.title}</h1>
          <div className="dept-badge page-dept-badge">{batch.department || "AX팀"}</div>
          <p className="muted">{batch.memo || "이 주문 목록 안에서 원하는 음료를 골라 주문해 주세요."}</p>
        </div>
        <div><a href="/">주문 목록</a> · <a href="/admin">관리자</a></div>
      </div>

      <section className="hero-card">
        <div className="hero-content">
          <div className="hero-pills">
            <span>빠른 주문</span>
            <span>최근 주문 재사용</span>
            <span>인기 메뉴 자동 반영</span>
          </div>
          <h2>{popularRows.length ? "이번 주문에서 많이 담긴 메뉴부터 빠르게 고르세요." : "지금 많이 찾는 메뉴를 먼저 보여드릴게요."}</h2>
          <p className="hero-copy">
            실제 주문 데이터를 바탕으로 인기 메뉴를 먼저 노출하고, 주문 확정과 수령 완료는 관리자 화면에서 직접 상태를 갱신합니다.
          </p>
        </div>
      </section>

      <form className="layout" onSubmit={handleSubmit}>
        <section>
          <div className="toolbar">
            <div className="tabs">
              {(Object.keys(brandLabels) as Brand[]).map((nextBrand) => (
                <button
                  key={nextBrand}
                  type="button"
                  className={brand === nextBrand ? "active" : ""}
                  onClick={() => setBrand(nextBrand)}
                >
                  {brandLabels[nextBrand]}
                </button>
              ))}
            </div>
            <div className="filters">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="메뉴명 검색" />
            </div>
          </div>

          {popularRows.length ? (
            <section className="popular-strip">
              <div className="popular-strip-head">
                <div>
                  <p className="eyebrow">Quick Picks</p>
                  <h3>이번 주문 인기 메뉴</h3>
                </div>
                <span className="muted">주문 수량 기준 상위 메뉴</span>
              </div>
              <div className="popular-grid">
                {popularRows.map((row) => {
                  const menu = menus.find((item) => item.id === row.menuId);
                  if (!menu) return null;
                  return (
                    <button className="popular-card" key={row.menuId} type="button" onClick={() => openMenu(menu)}>
                      <img src={menu.imageUrl} alt="" />
                      <div>
                        <strong>{menu.name}</strong>
                        <span>{menu.category} · {row.quantity}잔</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="category-strip">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {categoryLabel(item)}
              </button>
            ))}
          </div>

          <div className="menu-sections">
            {menuGroups.size ? (
              [...menuGroups.entries()].map(([groupName, rows]) => (
                <details className={`menu-section ${groupName === "POPULAR" ? "popular-section" : ""}`} key={groupName} open={groupName === "POPULAR" || groupName === "NEW"}>
                  <summary className="menu-section-header">
                    <h3>{categoryLabel(groupName)}</h3>
                    <span className="menu-section-count"><strong>{rows.length}</strong></span>
                    <span className="menu-section-toggle">열기</span>
                  </summary>
                  <div className="menu-section-body">
                    <div className="menu-grid">
                      {rows.map((menu) => (
                        <article className="card" key={menu.id}>
                          <img src={menu.imageUrl} alt="" />
                          <div>
                            <span className="meta">{brandLabels[menu.brand]} · {menu.category}</span>
                            <h3>{menu.name}</h3>
                            <button className="secondary" type="button" onClick={() => openMenu(menu)}>담기</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              ))
            ) : (
              <div className="empty">조건에 맞는 메뉴가 없습니다.</div>
            )}
          </div>
        </section>

        <aside>
          <h2>내 주문</h2>
          <label>
            <span>이름 *</span>
            <input value={ordererName} onChange={(event) => setOrdererName(event.target.value)} placeholder="주문자 이름" />
          </label>

          {savedOrder?.items.length ? (
            <div className="recent-order">
              <div>
                <strong>최근 주문</strong>
                <p className="muted">
                  {savedOrder.items.slice(0, 3).map((item) => item.menuName).join(", ")}
                  {savedOrder.items.length > 3 ? ` 외 ${savedOrder.items.length - 3}개` : ""}
                </p>
              </div>
              <button className="soft-action" type="button" onClick={applyRecentOrder}>다시 담기</button>
            </div>
          ) : null}

          <div className="flow-card">
            <strong>주문 진행 흐름</strong>
            <p className="muted">주문 접수 후 주문 확정, 매장 주문 완료, 수령 완료 상태는 관리자 화면에서 직접 바뀝니다.</p>
          </div>

          <h2>장바구니</h2>
          <div className="cart">
            {cart.length ? (
              cart.map((item) => (
                <div className="cart-item" key={item.localId}>
                  <strong>{item.menuName}</strong>
                  <div className="meta">{brandLabels[item.brand]} · {item.size}</div>
                  {item.customRequest ? <p>{item.customRequest}</p> : null}
                  <div className="cart-actions">
                    <button type="button" onClick={() => updateQuantity(item.localId, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.localId, item.quantity + 1)}>+</button>
                    <button type="button" onClick={() => setCart((current) => current.filter((row) => row.localId !== item.localId))}>×</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">선택한 음료가 아직 없습니다.</div>
            )}
          </div>

          {message ? <p className="message">{message}</p> : null}
          <button className="primary" type="submit">
            <ShoppingBag size={18} />
            {editingOrderId ? "주문 수정" : "주문 제출"}
          </button>
        </aside>
      </form>

      <section className="public-orders">
        <div className="top">
          <div>
            <h2>현재 주문 목록</h2>
            <p className="muted">제출한 뒤에도 여기에서 내 주문을 다시 수정하거나 취소할 수 있습니다.</p>
          </div>
          <button className="soft-action" type="button" onClick={() => void refreshPublicOrders()}>주문 목록 새로고침</button>
        </div>
        <div className="stats">
          <span className="stat">주문자 {totalPeople}명</span>
          <span className="stat">음료 {totalCups}잔</span>
        </div>
        <div className="public-order-grid">
          {publicOrders.length ? (
            publicOrders.map((order) => {
              const mine = ordererName.trim() && order.ordererName === ordererName.trim();
              return (
                <article className={`public-order ${mine ? "mine" : ""}`} key={order.id}>
                  <h3>
                    {order.ordererName} {mine ? <span className="badge">내 주문</span> : null}
                  </h3>
                  <p className="muted">
                    {new Date(order.orderedAt).toLocaleString("ko-KR")}
                    <span className="order-status-badge">{statusLabel(order.status)}</span>
                  </p>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {brandLabels[item.brand]} · {item.menuName} · {item.size} · {item.quantity}잔
                        {item.customRequest ? <em>{item.customRequest}</em> : null}
                      </li>
                    ))}
                  </ul>
                  {mine ? (
                    <div className="filters">
                      <button className="secondary" type="button" onClick={() => startEdit(order)}>수정</button>
                      <button className="danger" type="button" onClick={() => void handleCancel(order.id)}>취소</button>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="empty">아직 제출된 주문이 없습니다.</div>
          )}
        </div>
      </section>

      {selectedMenu ? (
        <div className="backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="menu-modal-title">
            <button className="close" type="button" aria-label="닫기" onClick={() => setSelectedMenu(null)}>
              <X size={18} />
            </button>
            <img src={selectedMenu.imageUrl} alt="" />
            <h2 id="menu-modal-title">{selectedMenu.name}</h2>
            <p>{selectedMenu.category}</p>
            <div className="sizes">
              {selectedMenu.availableSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={selectedSize === size ? "active" : ""}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
            <label>
              <span>수량</span>
              <input min={1} type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} />
            </label>
            <label>
              <span>요청 사항</span>
              <textarea rows={3} value={customRequest} onChange={(event) => setCustomRequest(event.target.value)} placeholder="예: 샷 추가, 얼음 적게" />
            </label>
            <button className="primary" type="button" onClick={addToCart}>장바구니 담기</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
