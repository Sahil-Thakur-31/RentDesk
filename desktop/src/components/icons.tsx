import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props
});

export const DashboardIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="3" width="7" height="9" rx="2" />
    <rect x="14" y="3" width="7" height="5" rx="2" />
    <rect x="14" y="12" width="7" height="9" rx="2" />
    <rect x="3" y="16" width="7" height="5" rx="2" />
  </svg>
);

export const BuildingIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    <path d="M10 21v-4h4v4" />
  </svg>
);

export const UnitsIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
);

export const TenantsIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3.3 2.6-6 6-6s6 2.7 6 6" />
    <circle cx="17.5" cy="7.5" r="2.4" />
    <path d="M15.7 12.4c2.6.3 4.6 2.5 4.8 5.3" />
  </svg>
);

export const TransactionsIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <path d="M7 15h4" />
  </svg>
);

export const UtilitiesIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);

export const ReportsIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 19V9M10 19V5M16 19v-7M21 19H3" />
  </svg>
);

export const CalendarIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </svg>
);

export const BellIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const UserIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c0-4 3.4-7 7.5-7s7.5 3 7.5 7" />
  </svg>
);

export const SettingsIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.36.36.68.66.92" />
  </svg>
);

export const LogoutIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const CheckCircleIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.3 2.3L16 10" />
  </svg>
);

export const XCircleIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9.5 9.5 5 5m0-5-5 5" />
  </svg>
);

export const InfoCircleIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <path d="M12 7.5h.01" />
  </svg>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3.5 22 20H2L12 3.5Z" />
    <path d="M12 10v4.5" />
    <path d="M12 17.5h.01" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PencilIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const WrenchIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M14.7 6.3a4 4 0 0 0-5.6 5l-6.1 6.1a1.5 1.5 0 0 0 2.1 2.1l6.1-6.1a4 4 0 0 0 5-5.6l-2.5 2.5-2-2 2.5-2.5Z" />
  </svg>
);

export const ShieldIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3 4.5 6v6c0 4.5 3.2 7.4 7.5 9 4.3-1.6 7.5-4.5 7.5-9V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const CashIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 10v.01M18 14v.01" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const SortIcon = (props: IconProps & { state?: 'asc' | 'desc' | 'none' }) => {
  const { state = 'none', ...rest } = props;
  if (state === 'asc') {
    return (
      <svg {...base(rest)} width={rest.width ?? 12} height={rest.height ?? 12}>
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    );
  }
  if (state === 'desc') {
    return (
      <svg {...base(rest)} width={rest.width ?? 12} height={rest.height ?? 12}>
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    );
  }
  return (
    <svg {...base(rest)} width={rest.width ?? 12} height={rest.height ?? 12} strokeWidth={1.5}>
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  );
};

export const WifiOffIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M2 2l20 20" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M5 12.5a10 10 0 0 1 3-2M19 12.5a10 10 0 0 0-3.5-2.3" />
    <path d="M1.5 8.5A16 16 0 0 1 5.5 6" />
    <path d="M22.5 8.5a16 16 0 0 0-5-2.9" />
    <path d="M12 20h.01" />
  </svg>
);

export const GlobeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const DatabaseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5V18c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5" />
    <path d="M4 11.75C4 13.4 7.6 14.75 12 14.75s8-1.35 8-3" />
  </svg>
);

export const KeyIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="8" cy="15" r="4.5" />
    <path d="M11.5 11.5 20 3M16 6l2.5 2.5M13 9l2 2" />
  </svg>
);

export const UsersIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3.3 2.6-6 6-6s6 2.7 6 6" />
    <circle cx="17.5" cy="7.5" r="2.4" />
    <path d="M15.7 12.4c2.6.3 4.6 2.5 4.8 5.3" />
  </svg>
);

export const PrinterIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 9V3h12v6" />
    <rect x="4" y="9" width="16" height="8" rx="1.5" />
    <path d="M6 14h12v7H6z" />
  </svg>
);

export const EyeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.06 21.06 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.05 21.05 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
