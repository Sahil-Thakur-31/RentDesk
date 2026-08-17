import { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
}

const ChartCard = ({ title, children }: ChartCardProps) => {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="h-2 w-20 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]" />
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
};

export default ChartCard;
