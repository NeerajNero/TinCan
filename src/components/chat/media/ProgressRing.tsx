export function ProgressRing({ fraction, size = 44 }: { fraction: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="progressbar" aria-valuenow={Math.round(clamped * 100)} aria-valuemin={0} aria-valuemax={100}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.2s" }}
      />
    </svg>
  );
}
