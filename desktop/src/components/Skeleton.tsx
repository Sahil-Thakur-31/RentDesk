interface SkeletonBlockProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: string;
}

export const SkeletonBlock = ({ className = '', width, height, rounded = 'rounded-lg' }: SkeletonBlockProps) => (
  <div
    className={`skeleton ${rounded} ${className}`}
    style={{ width, height }}
  />
);

interface SkeletonTableProps {
  columns?: number;
  rows?: number;
  toolbar?: boolean;
  tabCount?: number;
}

export const SkeletonTable = ({ columns = 5, rows = 6, toolbar = true, tabCount = 0 }: SkeletonTableProps) => (
  <div className="card overflow-hidden">
    {tabCount > 0 && (
      <div className="flex items-center gap-2 flex-wrap px-4 pt-4 pb-3">
        {Array.from({ length: tabCount }).map((_, i) => (
          <SkeletonBlock key={i} height={36} width={i === 0 ? 92 : 104} rounded="rounded-full" />
        ))}
      </div>
    )}
    {toolbar && (
      <div className="flex items-center gap-3 border-b border-black/5 p-4">
        <SkeletonBlock height={36} className="flex-1 max-w-xs" />
        <SkeletonBlock height={36} width={120} />
      </div>
    )}
    <div className="p-1">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <SkeletonBlock height={10} width="60%" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-t border-black/5">
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <SkeletonBlock height={14} width={c === columns - 1 ? '70%' : `${55 + ((r + c) % 4) * 10}%`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const SkeletonCardGrid = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <SkeletonBlock height={20} width="55%" />
          <SkeletonBlock height={22} width={72} rounded="rounded-full" />
        </div>
        <SkeletonBlock height={14} width="80%" />
        <SkeletonBlock height={12} width="40%" />
        <div className="flex items-center gap-2 pt-2">
          <SkeletonBlock height={30} width={64} rounded="rounded-lg" />
          <SkeletonBlock height={30} width={64} rounded="rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonInfoCard = ({ fields = 4, actions = 2 }: { fields?: number; actions?: number }) => (
  <div className="card p-6">
    <div className="flex items-center justify-between mb-4">
      <SkeletonBlock height={14} width={120} />
      <div className="flex items-center gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <SkeletonBlock key={i} height={30} width={80} rounded="rounded-lg" />
        ))}
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonBlock height={9} width="50%" />
          <SkeletonBlock height={14} width="75%" />
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonStatCards = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card relative overflow-hidden p-5">
        <div className="absolute left-0 top-0 h-1 w-full skeleton" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock height={10} width="60%" />
            <SkeletonBlock height={24} width="70%" />
            <SkeletonBlock height={10} width="50%" />
          </div>
          <SkeletonBlock height={40} width={40} rounded="rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonDashboardSummary = () => (
  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
    <div className="card p-6 space-y-4">
      <SkeletonBlock height={14} width={90} />
      <div className="flex items-baseline justify-between gap-3">
        <SkeletonBlock height={34} width={80} />
        <div className="flex flex-col items-end gap-2">
          <SkeletonBlock height={16} width={130} />
          <SkeletonBlock height={10} width={150} />
        </div>
      </div>
      <SkeletonBlock height={20} width="100%" rounded="rounded-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} height={40} width="100%" rounded="rounded-xl" />
        ))}
      </div>
    </div>

    <div className="card overflow-hidden">
      <div className="grid grid-cols-5 gap-1.5 p-1.5 border-b border-black/5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} height={42} width="100%" rounded="rounded-xl" />
        ))}
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} height={66} width="100%" rounded="rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
);

const statRowColsClass: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6'
};

export const SkeletonStatRow = ({ count = 5, colsClassName }: { count?: number; colsClassName?: string }) => (
  <div className={`grid grid-cols-1 ${colsClassName || statRowColsClass[count] || 'md:grid-cols-5'} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card p-5 space-y-3">
        <SkeletonBlock height={10} width="70%" />
        <SkeletonBlock height={22} width="50%" />
        <SkeletonBlock height={10} width="60%" />
      </div>
    ))}
  </div>
);

export const SkeletonDetailHeader = ({
  avatar = false,
  actions = 2,
  fields = 0
}: {
  avatar?: boolean;
  actions?: number;
  fields?: number;
}) => (
  <div className="card p-6 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        {avatar && <SkeletonBlock height={48} width={48} rounded="rounded-2xl" />}
        <div className="space-y-2">
          <SkeletonBlock height={22} width={220} />
          <SkeletonBlock height={14} width={160} />
          <SkeletonBlock height={12} width={120} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 justify-end">
        {Array.from({ length: actions }).map((_, i) => (
          <SkeletonBlock key={i} height={38} width={90} />
        ))}
      </div>
    </div>
    {fields > 0 && (
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonBlock height={9} width={60} />
            <SkeletonBlock height={14} width="75%" />
          </div>
        ))}
      </div>
    )}
  </div>
);
