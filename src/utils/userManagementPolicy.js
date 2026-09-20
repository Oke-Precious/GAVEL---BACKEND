const isSameUser = (actor, target) => actor._id.toString() === target._id.toString();

const getManagementDenial = (actor, target, action) => {
  const sameUser = isSameUser(actor, target);

  if (sameUser && ['suspend', 'delete'].includes(action)) {
    return `You cannot ${action} your own account`;
  }

  if (sameUser) {
    return null;
  }

  if (target.role === 'super_admin') {
    return 'Super administrator accounts cannot be managed through this endpoint';
  }

  if (action === 'delete' && actor.role !== 'super_admin') {
    return 'Only a super administrator can delete user accounts';
  }

  if (target.role === 'admin' && actor.role !== 'super_admin') {
    return `Only a super administrator can ${action} an administrator account`;
  }

  return null;
};

const getDeletionConfirmation = email => `DELETE ${email}`;

module.exports = {
  getManagementDenial,
  getDeletionConfirmation,
  isSameUser
};
