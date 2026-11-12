"use client";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-in max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card p-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-ink-2 active:bg-track">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
