const USER_ROLES = Object.freeze([
  'super_admin',
  'admin',
  'judge',
  'lawyer',
  'clerk',
  'litigant',
  'public'
]);

const INVITABLE_ROLES = Object.freeze(USER_ROLES.filter(role => role !== 'super_admin'));
const STANDARD_ROLES = Object.freeze(INVITABLE_ROLES.filter(role => role !== 'admin'));

module.exports = {
  USER_ROLES,
  INVITABLE_ROLES,
  STANDARD_ROLES
};
