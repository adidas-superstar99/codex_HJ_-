import type { Brand } from "../types";

const labels: Record<Brand, string> = {
  STARBUCKS: "스타벅스",
  TWOSOME: "투썸플레이스"
};

export function BrandTabs({ value, onChange }: { value: Brand; onChange: (brand: Brand) => void }) {
  return (
    <div className="segmented" aria-label="브랜드 선택">
      {(Object.keys(labels) as Brand[]).map((brand) => (
        <button
          key={brand}
          type="button"
          className={value === brand ? "active" : ""}
          onClick={() => onChange(brand)}
        >
          {labels[brand]}
        </button>
      ))}
    </div>
  );
}
