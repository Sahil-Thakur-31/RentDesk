interface FieldErrorProps {
  message?: string;
}

const FieldError = ({ message }: FieldErrorProps) => {
  if (!message) return null;

  return (
    <div className="field-error-pop pointer-events-none absolute left-0 top-full z-30 mt-1.5">
      <span className="absolute -top-1 left-3 h-2 w-2 rotate-45 bg-[var(--danger)]" />
      <span className="relative block whitespace-nowrap rounded-lg bg-[var(--danger)] px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
        {message}
      </span>
    </div>
  );
};

export default FieldError;
