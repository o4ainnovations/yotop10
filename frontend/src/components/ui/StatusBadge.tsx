interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
  approved: { bg: '#e8f5e9', color: '#2e7d32', border: '#4caf50' },
  pending_review: { bg: '#fff3e0', color: '#e65100', border: '#ff9800' },
  rejected: { bg: '#ffebee', color: '#b71c1c', border: '#d32f2f' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || { bg: '#f5f5f5', color: '#666', border: '#ccc' };
  const label = status.replace(/_/g, ' ');

  return (
    <span
      style={{
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </span>
  );
}
