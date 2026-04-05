import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import type { UserProfile } from '../../../shared/types/user';

interface BasicProfileFormProps {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
}

const accessibilityPresets = [
  { value: '', label: 'No additional support needed' },
  { value: 'I need spoken guidance and read-aloud support.', label: 'Yes - spoken guidance' },
  { value: 'I need high contrast mode and larger text.', label: 'Yes - high contrast and larger text' },
  { value: '__custom__', label: 'Other / custom note' },
];

function getAccessibilityPreset(value?: string) {
  if (!value) return '';
  const preset = accessibilityPresets.find((item) => item.value === value);
  return preset ? preset.value : '__custom__';
}

export default function BasicProfileForm({ profile, setProfile }: BasicProfileFormProps) {
  const { t } = useLanguage();
  const selectedAccessibilityPreset = getAccessibilityPreset(profile.accessibilityNeeds);
  const accessibilityOptions = accessibilityPresets.map((item) => ({
    value: item.value,
    label:
      item.label === 'Yes - spoken guidance'
        ? t('Yes - spoken guidance')
        : item.label === 'Yes - high contrast and larger text'
          ? t('Yes - high contrast and larger text')
          : item.label === 'Other / custom note'
            ? t('Other / custom note')
            : t('No additional support needed'),
  }));

  return (
    <div className="grid-2">
      <Select
        label={t('Gender')}
        value={profile.gender ?? ''}
        onChange={(event) => setProfile({ ...profile, gender: event.target.value })}
        options={[
          { value: '', label: t('Select') },
          { value: 'Female', label: t('Female') },
          { value: 'Male', label: t('Male') },
          { value: 'Non-binary', label: t('Non-binary') },
          { value: 'Prefer not to say', label: t('Prefer not to say') },
        ]}
      />
      <Input
        label={t('Birthday')}
        type="date"
        value={profile.birthday ?? ''}
        onChange={(e) => setProfile({ ...profile, birthday: e.target.value })}
      />
      <Input
        label={t('Height (cm)')}
        type="number"
        value={profile.height ?? ''}
        onChange={(e) => setProfile({ ...profile, height: Number(e.target.value) || undefined })}
      />
      <Input
        label={t('Weight (kg)')}
        type="number"
        value={profile.weight ?? ''}
        onChange={(e) => setProfile({ ...profile, weight: Number(e.target.value) || undefined })}
      />
      <Input
        label={t('Climbing experience')}
        value={profile.climbingExperience ?? ''}
        onChange={(e) => setProfile({ ...profile, climbingExperience: e.target.value })}
        hint={t('Example: beginner, some gym experience, regular climber')}
      />
      <Select
        label={t('Need accessibility assistance?')}
        value={selectedAccessibilityPreset}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue === '__custom__') {
            setProfile({
              ...profile,
              accessibilityNeeds: profile.accessibilityNeeds ?? '',
            });
            return;
          }

          setProfile({
            ...profile,
            accessibilityNeeds: nextValue || undefined,
          });
        }}
        options={accessibilityOptions}
      />
      <Textarea
        label={t('Accessibility needs details')}
        value={profile.accessibilityNeeds ?? ''}
        onChange={(e) => setProfile({ ...profile, accessibilityNeeds: e.target.value || undefined })}
        placeholder={t('Screen reader, high contrast, spoken route preview...')}
        rows={4}
      />
    </div>
  );
}
