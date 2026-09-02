const PATHS: Record<string, string> = {
  boot: 'M9 4h6v7l4 3v6H7v-6l2-2z',
  sandal: 'M4 16h16v3a2 2 0 01-2 2H6a2 2 0 01-2-2z M6 16V9a2 2 0 012-2h8a2 2 0 012 2v7',
  shoe: 'M3 17c0-2 2-3 4-4l8-4 4 2v4a2 2 0 01-2 2H3z',
  textile: 'M3 4h18v4H3z M3 10h18v4H3z M3 16h18v4H3z',
  sweater: 'M6 3l3 2h6l3-2 3 4-3 2v11H6V9L3 7z',
  hat: 'M4 15c0-4 4-7 8-7s8 3 8 7z M2 15h20v2H2z',
  sneaker: 'M3 15c2-1 3-3 6-3 2 0 3 1 5 1s4-2 6-1v4a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  bag: 'M6 8h12l1 12H5z M9 8V6a3 3 0 016 0v2',
}

export function ProductIcon({ kind, size = 34 }: { kind: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[kind] || PATHS.shoe} />
    </svg>
  )
}
