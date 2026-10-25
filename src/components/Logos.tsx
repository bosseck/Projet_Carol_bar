interface Mark {
  className?: string;
}

/** Logotype du comptoir : casier de bouteilles posé sur un comptoir. */
export function ShopLogo({ className = "h-11 w-11" }: Mark) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="14" fill="#12241d" />
      <rect x="9" y="30" width="30" height="4" rx="1.5" fill="#e3a45c" />
      <g fill="#f3e2cc">
        <rect x="13" y="16" width="5.4" height="13" rx="2.4" />
        <rect x="21.3" y="16" width="5.4" height="13" rx="2.4" />
        <rect x="29.6" y="16" width="5.4" height="13" rx="2.4" />
      </g>
      <g fill="#e3a45c">
        <rect x="14.4" y="11" width="2.6" height="5" rx="1.2" />
        <rect x="22.7" y="11" width="2.6" height="5" rx="1.2" />
        <rect x="31" y="11" width="2.6" height="5" rx="1.2" />
      </g>
    </svg>
  );
}

/** Pictogramme bar : chope de bière. */
export function BeerLogo({ className = "h-5 w-5" }: Mark) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Z" />
      <path d="M15 11h2.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H15" />
      <path d="M6 8a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3" />
    </svg>
  );
}

/** Pictogramme épicerie : sac de courses. */
export function GroceryLogo({ className = "h-5 w-5" }: Mark) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

/** Pictogramme caisse / bénéfice. */
export function CashLogo({ className = "h-5 w-5" }: Mark) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 12h.01M17.5 12h.01" />
    </svg>
  );
}

/** Pictogramme stock / casier. */
export function StockLogo({ className = "h-5 w-5" }: Mark) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M3.5 12h17M12 4v16M8 8h.01M16 16h.01" />
    </svg>
  );
}

/** Pictogramme historique. */
export function JournalLogo({ className = "h-5 w-5" }: Mark) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" />
      <path d="M8 7h7M8 11h7M8 15h4" />
    </svg>
  );
}
