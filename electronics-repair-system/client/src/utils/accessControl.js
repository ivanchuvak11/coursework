export function normalizeRole(role = '') {
  return String(role).trim().toLowerCase();
}

export function hasRole(user, roles) {
  const currentRole = normalizeRole(user?.role);
  return roles.some((role) => currentRole === normalizeRole(role));
}

export function isAdminRole(user) {
  return hasRole(user, ['адмін', 'admin']);
}

export function isManagerRole(user) {
  return hasRole(user, ['менеджер', 'manager']);
}

export function isMasterRole(user) {
  return hasRole(user, ['майстер', 'master']);
}
