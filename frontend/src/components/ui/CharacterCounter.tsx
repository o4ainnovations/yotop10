interface CharacterCounterProps {
  current: number;
  max: number;
}

export default function CharacterCounter({ current, max }: CharacterCounterProps) {
  const ratio = current / max;
  const color = ratio > 0.95 ? '#d32f2f' : ratio > 0.8 ? '#ff9800' : '#666';

  return (
    <span style={{ color, fontSize: '12px' }}>
      {current}/{max}
    </span>
  );
}
