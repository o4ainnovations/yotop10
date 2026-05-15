const HEAT_CELLS: { color: string; opacity: string }[] = [
  { color: 'bg-orange-500', opacity: '/30' },
  { color: 'bg-orange-500', opacity: '/50' },
  { color: 'bg-orange-500', opacity: '/60' },
  { color: 'bg-red-500', opacity: '/40' },
  { color: 'bg-red-500', opacity: '/50' },
  { color: 'bg-orange-500', opacity: '/70' },
  { color: 'bg-red-500', opacity: '/60' },
  { color: 'bg-red-500', opacity: '/70' },
  { color: 'bg-red-500', opacity: '/80' },
];

export function ConsensusHeatmap() {
  return (
    <div className="rounded-xl glass-slab p-4">
      <h3 className="text-[10px] font-mono tracking-widest text-zinc-600 mb-3">
        CONSENSUS HEATMAP
      </h3>
      <div className="grid grid-cols-3 gap-1 mb-3">
        {HEAT_CELLS.map((cell, i) => (
          <div
            key={i}
            className={`h-3 rounded-sm ${cell.color}${cell.opacity}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500/60" />
          <span className="text-[10px] font-mono text-zinc-500">SUPPORT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/60" />
          <span className="text-[10px] font-mono text-zinc-500">DISPUTE</span>
        </div>
      </div>
    </div>
  );
}
