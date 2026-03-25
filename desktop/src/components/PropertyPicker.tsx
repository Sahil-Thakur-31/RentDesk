import { useI18n } from '../lib/i18n';

interface PropertyPickerProps {
  properties: Array<{ _id: string; name: string }>;
  value: string;
  onChange: (value: string) => void;
}

const PropertyPicker = ({ properties, value, onChange }: PropertyPickerProps) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3">
      <select
        className="border border-black/10 rounded-lg px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t('All Properties')}</option>
        {properties.map((property) => (
          <option key={property._id} value={property._id}>
            {property.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PropertyPicker;

