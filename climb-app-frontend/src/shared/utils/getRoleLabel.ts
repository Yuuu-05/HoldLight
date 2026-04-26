import { roleOptions } from '../constants/roles';

export function getRoleLabel(role?: string) {
  return roleOptions.find((item) => item.value === role)?.label ?? 'Member';
}
