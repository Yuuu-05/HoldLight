import Select from '../../../shared/components/ui/Select';
import { roleOptions, type RoleValue } from '../../../shared/constants/roles';
import { useLanguage } from '../../../app/providers/LanguageProvider';

interface RoleSelectorProps {
  value: RoleValue;
  onChange: (value: RoleValue) => void;
}

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const { t } = useLanguage();

  return (
    <Select
      label={t('Role')}
      value={value}
      onChange={(event) => onChange(event.target.value as RoleValue)}
      options={roleOptions.map((option) => ({ value: option.value, label: t(option.label) }))}
    />
  );
}
