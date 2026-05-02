export function SizeSelector({ sizes, value, onChange }: { sizes: string[]; value: string; onChange: (size: string) => void }) {
  return (
    <div className="size-selector">
      {sizes.map((size) => (
        <button key={size} className={value === size ? "active" : ""} type="button" onClick={() => onChange(size)}>
          {size}
        </button>
      ))}
    </div>
  );
}
