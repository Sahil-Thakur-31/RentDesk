import { useEffect, useState } from 'react';
import api from '../lib/api';
import { CloseIcon } from './icons';
import { getCurrentDateValue } from '../lib/dateFormat';
import { toast } from '../lib/toast';
import { formatCurrency } from '../lib/format';
import FieldError from './FieldError';
import DatePicker from './DatePicker';
import { type FieldErrors } from '../lib/validation';

type DepositPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  tenantId: string;
  unitId?: string;
  tenantName: string;
  requiredDeposit: number;
  paidDeposit: number;
  onSaved?: () => void;
};

const DepositPaymentModal = ({
  open,
  onClose,
  propertyId,
  tenantId,
  unitId,
  tenantName,
  requiredDeposit,
  paidDeposit,
  onSaved
}: DepositPaymentModalProps) => {
  const remaining = Math.max(0, requiredDeposit - paidDeposit);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getCurrentDateValue());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setAmount(remaining > 0 ? String(remaining) : '');
    setDate(getCurrentDateValue());
    setNotes('');
    setErrors({});
  }, [open, remaining]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount || 0);
    const next: FieldErrors = {};
    if (!numericAmount || numericAmount <= 0) next.amount = 'Enter a valid deposit amount';
    else if (numericAmount > remaining) next.amount = 'Cannot exceed remaining deposit';
    if (!date) next.date = 'Date is required';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      await api.post(`/properties/${propertyId}/payments`, {
        type: 'deposit',
        amount: numericAmount,
        date,
        unitId: unitId || undefined,
        tenantId,
        notes: notes || 'Security deposit collected'
      });
      onClose();
      onSaved?.();
      toast.success('Deposit recorded.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record deposit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-black/5 shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold">Collect Deposit</div>
            <div className="text-sm text-[var(--muted)]">{tenantName}</div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
          <div className="rounded-2xl bg-black/5 px-4 py-3">
            <div className="text-xs text-[var(--muted)]">Required</div>
            <div className="font-semibold">{`₹${formatCurrency(requiredDeposit)}`}</div>
          </div>
          <div className="rounded-2xl bg-black/5 px-4 py-3">
            <div className="text-xs text-[var(--muted)]">Paid</div>
            <div className="font-semibold">{`₹${formatCurrency(paidDeposit)}`}</div>
          </div>
          <div className="rounded-2xl bg-black/5 px-4 py-3">
            <div className="text-xs text-[var(--muted)]">Remaining</div>
            <div className="font-semibold">{`₹${formatCurrency(remaining)}`}</div>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="relative">
            <label className="text-xs text-[var(--muted)]">Deposit Received Now</label>
            <input
              className={`w-full px-3 py-2 mt-1 ${errors.amount ? 'input-error' : ''}`}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrors((prev) => (prev.amount ? { ...prev, amount: undefined } : prev));
              }}
              placeholder="Enter amount"
            />
            <FieldError message={errors.amount} />
          </div>
          <div className="relative">
            <label className="text-xs text-[var(--muted)]">Date</label>
            <DatePicker
              className={`w-full px-3 py-2 mt-1 rounded-xl border border-black/10 ${errors.date ? 'input-error' : ''}`}
              value={date}
              onChange={(next) => {
                setDate(next);
                setErrors((prev) => (prev.date ? { ...prev, date: undefined } : prev));
              }}
            />
            <FieldError message={errors.date} />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)]">Notes (Optional)</label>
            <input
              className="w-full px-3 py-2 mt-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Security deposit collected"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || remaining <= 0}
            >
              {saving ? 'Saving...' : 'Save Deposit'}
            </button>
            <button type="button" className="btn btn-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepositPaymentModal;
