import { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
}

const ChartCard = ({ title, children }: ChartCardProps) => {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="h-2 w-20 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]" />
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
};

export default ChartCard;
