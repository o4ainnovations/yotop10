'use client';

interface TickerItem {
  id: string;
  username: string;
  avatarLetter: string;
  snippet: string;
  time: string;
  velocity: string;
  sparklineHeights: string[];
}

const DEMO_DATA: TickerItem[] = [
  {
    id: 't1',
    username: 'crypto_whale',
    avatarLetter: 'C',
    snippet: 'Bitcoin will replace gold as a store of value within 5 years.',
    time: '3m ago',
    velocity: '4.2/min',
    sparklineHeights: ['h-1', 'h-2', 'h-4', 'h-2'],
  },
  {
    id: 't2',
    username: 'debate_lord',
    avatarLetter: 'D',
    snippet: 'Actually, gold has 5000 years of history. BTC has 15.',
    time: '7m ago',
    velocity: '2.8/min',
    sparklineHeights: ['h-3', 'h-1', 'h-2', 'h-2'],
  },
  {
    id: 't3',
    username: 'fact_checker',
    avatarLetter: 'F',
    snippet: 'The data shows adoption curve is steeper than internet in 90s.',
    time: '11m ago',
    velocity: '3.5/min',
    sparklineHeights: ['h-2', 'h-4', 'h-3', 'h-1'],
  },
  {
    id: 't4',
    username: 'anon_sage',
    avatarLetter: 'A',
    snippet: 'Ranked lists should be immutable once published on-chain.',
    time: '14m ago',
    velocity: '1.9/min',
    sparklineHeights: ['h-1', 'h-3', 'h-2', 'h-4'],
  },
  {
    id: 't5',
    username: 'meme_king',
    avatarLetter: 'M',
    snippet: 'No, editing is essential — rankings change with new evidence.',
    time: '18m ago',
    velocity: '0.8/min',
    sparklineHeights: ['h-2', 'h-2', 'h-1', 'h-3'],
  },
  {
    id: 't6',
    username: 'data_ninja',
    avatarLetter: 'D',
    snippet: 'L2 scaling solutions will make ETH fees negligible by Q4.',
    time: '22m ago',
    velocity: '5.1/min',
    sparklineHeights: ['h-4', 'h-3', 'h-2', 'h-4'],
  },
  {
    id: 't7',
    username: 'crypto_whale',
    avatarLetter: 'C',
    snippet: 'Decentralization is a spectrum, not a binary state.',
    time: '27m ago',
    velocity: '2.3/min',
    sparklineHeights: ['h-3', 'h-2', 'h-1', 'h-3'],
  },
  {
    id: 't8',
    username: 'debate_lord',
    avatarLetter: 'D',
    snippet: 'Proof of Stake is objectively more secure than Proof of Work.',
    time: '31m ago',
    velocity: '6.4/min',
    sparklineHeights: ['h-2', 'h-4', 'h-4', 'h-1'],
  },
  {
    id: 't9',
    username: 'fact_checker',
    avatarLetter: 'F',
    snippet: 'Disagree — PoW has real-world energy anchoring as a feature.',
    time: '35m ago',
    velocity: '3.9/min',
    sparklineHeights: ['h-4', 'h-1', 'h-3', 'h-2'],
  },
  {
    id: 't10',
    username: 'anon_sage',
    avatarLetter: 'A',
    snippet: 'NFTs are just signed URLs with extra steps. Prove me wrong.',
    time: '40m ago',
    velocity: '7.2/min',
    sparklineHeights: ['h-2', 'h-3', 'h-4', 'h-4'],
  },
  {
    id: 't11',
    username: 'meme_king',
    avatarLetter: 'M',
    snippet: 'Web3 gaming will onboard the next billion users, not DeFi.',
    time: '44m ago',
    velocity: '1.5/min',
    sparklineHeights: ['h-1', 'h-2', 'h-2', 'h-3'],
  },
  {
    id: 't12',
    username: 'data_ninja',
    avatarLetter: 'D',
    snippet: 'The best tech doesn\'t win — the best narrative does.',
    time: '49m ago',
    velocity: '8.1/min',
    sparklineHeights: ['h-3', 'h-4', 'h-3', 'h-4'],
  },
];

export function ArgumentTicker() {
  const items = [...DEMO_DATA, ...DEMO_DATA];

  return (
    <div className="flex-1 overflow-hidden p-4">
      <h2 className="text-2xs font-mono tracking-[0.2em] text-zinc-600 mb-4">
        LIVE PULSE
      </h2>
      <div className="h-full overflow-hidden">
        <div className="animate-ticker">
          {items.map((item, i) => (
            <div key={`${item.id}-${i}`} className="rounded-2xl glass-obsidian p-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center rounded-full bg-white/10 text-xs font-mono text-zinc-400 w-5 h-5 shrink-0">
                  {item.avatarLetter}
                </span>
                <span className="font-mono text-xs text-zinc-300 truncate">
                  {item.username}
                </span>
                <span className="text-2xs text-zinc-600 ml-auto shrink-0">
                  {item.time}
                </span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
                {item.snippet}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="flex items-end gap-0.5 h-5">
                  {item.sparklineHeights.map((h, j) => (
                    <div
                      key={j}
                      className={`w-3 rounded-sm bg-orange-500/60 ${h}`}
                    />
                  ))}
                </div>
                <span className="text-2xs font-mono text-orange-400 ml-auto shrink-0">
                  {item.velocity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
