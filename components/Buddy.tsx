// Bao, the dashboard buddy: happy while you're within budget, sad when you go over.
export function Buddy({ mood, size = 64 }: { mood: "happy" | "sad"; size?: number }) {
  const happy = mood === "happy";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 76"
      role="img"
      aria-label={happy ? "Happy bao" : "Sad bao"}
      className={happy ? "buddy-bob" : "buddy-droop"}
    >
      <ellipse cx="40" cy="70" rx="24" ry="4" fill="var(--ink)" opacity="0.08" />
      {/* bun */}
      <path
        d="M9 50 C9 28 25 14 40 14 C55 14 71 28 71 50 C71 62 58 67 40 67 C22 67 9 62 9 50 Z"
        fill="#fff6e6"
        stroke="#ecd6b0"
        strokeWidth="2"
      />
      {/* pleats */}
      <path d="M33 20 Q40 9 47 20" fill="none" stroke="#e2c79a" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 18 Q40 12 44 18" fill="none" stroke="#e2c79a" strokeWidth="2" strokeLinecap="round" />
      {/* cheeks */}
      <ellipse cx="22" cy="49" rx="5" ry="3" fill="#ff9aa2" opacity={happy ? 0.75 : 0.4} />
      <ellipse cx="58" cy="49" rx="5" ry="3" fill="#ff9aa2" opacity={happy ? 0.75 : 0.4} />
      {happy ? (
        <g fill="none" stroke="#3b2a1a" strokeWidth="2.6" strokeLinecap="round">
          <path d="M26 42 Q30 37 34 42" />
          <path d="M46 42 Q50 37 54 42" />
          <path d="M35 49 Q40 55 45 49" />
        </g>
      ) : (
        <g fill="none" stroke="#3b2a1a" strokeWidth="2.6" strokeLinecap="round">
          <path d="M26 38 L33 41" />
          <path d="M54 38 L47 41" />
          <circle cx="30" cy="44" r="1.6" fill="#3b2a1a" stroke="none" />
          <circle cx="50" cy="44" r="1.6" fill="#3b2a1a" stroke="none" />
          <path d="M35 55 Q40 50 45 55" />
        </g>
      )}
      {!happy && <path d="M57 44 Q60 50 57 53 Q54 50 57 44 Z" fill="#7cc4ff" />}
    </svg>
  );
}

export function buddyLine(consumed: number, remaining: number, budget: number) {
  if (consumed === 0) return "Hungry? Tap + to log your first makan.";
  if (remaining < 0) return `Alamak… ${Math.abs(remaining).toLocaleString()} kcal over. Tomorrow can!`;
  if (remaining < budget * 0.15) return `Steady lah, ${remaining.toLocaleString()} kcal left. Almost there!`;
  return `Shiok! ${remaining.toLocaleString()} kcal left today.`;
}
