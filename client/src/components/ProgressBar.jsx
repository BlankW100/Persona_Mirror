const DOMAINS = ['voice', 'beliefs', 'decisions', 'conflict', 'taste'];

const LABELS = {
  voice: 'Voice',
  beliefs: 'Beliefs',
  decisions: 'Decisions',
  conflict: 'Conflict',
  taste: 'Taste',
};

const styles = {
  container: {
    display: 'flex',
    gap: '4px',
    padding: '12px 16px',
    borderBottom: '1px solid #1e1e1e',
  },
  segment: {
    flex: 1,
    height: '6px',
    borderRadius: '3px',
    background: '#2a2a2a',
    position: 'relative',
    cursor: 'default',
  },
  segmentActive: {
    background: '#00ff88',
  },
  label: {
    display: 'block',
    fontSize: '9px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#555',
    marginTop: '5px',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  labelActive: {
    color: '#00ff88',
  },
};

export default function ProgressBar({ domainProgress = [], currentDomain }) {
  return (
    <div style={styles.container}>
      {DOMAINS.map((d) => {
        const done = domainProgress.includes(d);
        const current = currentDomain === d;
        return (
          <div key={d} style={{ flex: 1 }}>
            <div
              style={{
                ...styles.segment,
                ...(done || current ? styles.segmentActive : {}),
                opacity: current && !done ? 0.6 : 1,
              }}
            />
            <span
              style={{
                ...styles.label,
                ...(done || current ? styles.labelActive : {}),
              }}
            >
              {LABELS[d]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
