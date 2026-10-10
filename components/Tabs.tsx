"use client";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

/** Scrollable tab bar (works at 375px). Tabs are 48px tall for easy tapping. */
export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<TabItem<T>>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" aria-label="Your case" className="no-print -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {tabs.map((item) => (
        <button
          key={item.id}
          role="tab"
          id={`tab-${item.id}`}
          aria-selected={active === item.id}
          aria-controls={`panel-${item.id}`}
          onClick={() => onChange(item.id)}
          className={`min-h-12 shrink-0 rounded-xl border px-4 py-2 text-base font-semibold ${
            active === item.id ? "border-accent bg-accent text-white" : "border-line bg-surface hover:bg-accent-soft"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
