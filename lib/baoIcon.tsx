// The app icon: Bao (the happy dashboard buddy from components/Buddy.tsx) on the brand orange.
// Rendered to PNG by next/og, which can't read CSS variables, so colours are written out.
const BAO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 76">
<ellipse cx="40" cy="70" rx="24" ry="4" fill="#000" opacity="0.12"/>
<path d="M9 50 C9 28 25 14 40 14 C55 14 71 28 71 50 C71 62 58 67 40 67 C22 67 9 62 9 50 Z" fill="#fff6e6" stroke="#ecd6b0" stroke-width="2"/>
<path d="M33 20 Q40 9 47 20" fill="none" stroke="#e2c79a" stroke-width="2" stroke-linecap="round"/>
<path d="M36 18 Q40 12 44 18" fill="none" stroke="#e2c79a" stroke-width="2" stroke-linecap="round"/>
<ellipse cx="22" cy="49" rx="5" ry="3" fill="#ff9aa2" opacity="0.75"/>
<ellipse cx="58" cy="49" rx="5" ry="3" fill="#ff9aa2" opacity="0.75"/>
<g fill="none" stroke="#3b2a1a" stroke-width="2.6" stroke-linecap="round">
<path d="M26 42 Q30 37 34 42"/><path d="M46 42 Q50 37 54 42"/><path d="M35 49 Q40 55 45 49"/>
</g>
</svg>`;
const SRC = `data:image/svg+xml;base64,${Buffer.from(BAO).toString("base64")}`;

// `px` is the icon's edge length; the bun fills ~72% so it survives iOS's rounded-corner mask.
export function BaoIcon({ px }: { px: number }) {
  const w = Math.round(px * 0.72);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e2622b" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SRC} width={w} height={Math.round((w * 76) / 80)} alt="" style={{ marginTop: Math.round(px * 0.02) }} />
    </div>
  );
}
