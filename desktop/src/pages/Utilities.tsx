import { useNavigate } from 'react-router-dom';

const Utilities = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          className="card card-hover p-6 text-left"
          onClick={() => navigate('/utilities/electricity-readings')}
        >
          <div className="text-sm text-[var(--muted)]">Electricity Reading</div>
          <div className="text-lg font-semibold mt-1">Enter Monthly Meter Readings</div>
          <div className="text-xs text-[var(--muted)] mt-2">
            Updates unit meter readings and auto-calculates electricity bills.
          </div>
        </button>
      </div>
    </div>
  );
};

export default Utilities;
