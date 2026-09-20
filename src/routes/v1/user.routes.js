const express = require('express');
const {
  getUsers,
  inviteUser,
  updateUser,
  suspendUser,
  reactivateUser,
  getUserAuditLog,
  getUserDeletionCheck,
  deleteUser
} = require('../../controllers/userController');
const { protect, authorize } = require('../../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { INVITABLE_ROLES } = require('../../constants/roles');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

const inviteValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('role').isIn(INVITABLE_ROLES).withMessage('Valid role is required'),
];

const userIdValidation = [
  param('id').isMongoId().withMessage('Invalid user ID')
];

const updateValidation = [
  ...userIdValidation,
  body('firstName').optional().isString().trim().notEmpty(),
  body('lastName').optional().isString().trim().notEmpty(),
  body('phoneNumber').optional().isString().trim(),
  body('barNumber').optional().isString().trim(),
  body('role').optional().isIn(INVITABLE_ROLES).withMessage('Invalid role specified')
];

const suspendValidation = [
  ...userIdValidation,
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

const deleteValidation = [
  ...userIdValidation,
  body('reason')
    .isString().withMessage('Deletion reason is required')
    .trim()
    .isLength({ min: 10, max: 500 }).withMessage('Deletion reason must be between 10 and 500 characters'),
  body('confirmation')
    .isString().withMessage('Deletion confirmation is required')
    .notEmpty().withMessage('Deletion confirmation is required')
];

router.route('/')
  .get(getUsers);

router.post('/invite', inviteValidation, validate, inviteUser);

router.patch('/:id/suspend', suspendValidation, validate, suspendUser);
router.patch('/:id/reactivate', userIdValidation, validate, reactivateUser);
router.get('/:id/audit-log', userIdValidation, validate, getUserAuditLog);
router.get('/:id/deletion-check', authorize('super_admin'), userIdValidation, validate, getUserDeletionCheck);

router.route('/:id')
  .patch(updateValidation, validate, updateUser)
  .delete(authorize('super_admin'), deleteValidation, validate, deleteUser);

module.exports = router;
