export const roleOptions = [
  { value: 'new_user', label: 'New climber' },
  { value: 'experienced', label: 'Experienced climber' },
  { value: 'visually_impaired', label: 'Visually impaired climber' },
] as const;

export type RoleValue = (typeof roleOptions)[number]['value'];
