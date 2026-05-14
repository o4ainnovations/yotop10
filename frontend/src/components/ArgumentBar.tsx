interface ArgumentBarProps {
  support: number;
  contradict: number;
}

export function ArgumentBar({ support, contradict }: ArgumentBarProps) {
  const total = support + contradict;
  const supportPct = total > 0 ? Math.round((support / total) * 100) : 50;
  const contradictPct = 100 - supportPct;

  return (
    <div>
      <div className="h-2 rounded-full overflow-hidden bg-white/5 flex">
        <div
          className="argument-bar-support h-full"
          style={{ width: `${supportPct}%` }}
        />
        <div
          className="argument-bar-contradict h-full"
          style={{ width: `${contradictPct}%` }}
        />
      </div>
      <div className="text-[10px] font-mono text-zinc-600 flex justify-between mt-1">
        <span>{supportPct}% Support</span>
        <span>{contradictPct}% Contradict</span>
      </div>
    </div>
  );
}
