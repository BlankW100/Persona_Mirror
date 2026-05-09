const DOMAIN_LABELS = {
  voice: 'Voice',
  beliefs: 'Beliefs',
  decisions: 'Decisions',
  conflict: 'Conflict',
  taste: 'Taste',
  complete: 'Complete',
};

export default function DomainBadge({ domain }) {
  if (!domain) return null;
  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontSize: '11px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#00ff88',
        border: '1px solid #00ff8840',
        borderRadius: '3px',
        padding: '2px 8px',
        background: '#00ff8808',
      }}
    >
      {DOMAIN_LABELS[domain] || domain}
    </span>
  );
}
