const express = require('express');
const { getUsers, inviteUser, updateUser, suspendUser, reactivateUser, getUserAuditLog } = require('../../controllers/userController');
const { protect, authorize } = require('../../middleware/auth');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

const inviteValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['admin', 'judge', 'lawyer', 'clerk', 'litigant', 'public']).withMessage('Valid role is required'),
];

router.route('/')
  .get(getUsers);

router.post('/invite', inviteValidation, validate, inviteUser);

router.patch('/:id/suspend', suspendUser);
router.patch('/:id/reactivate', reactivateUser);
router.get('/:id/audit-log', getUserAuditLog);

router.route('/:id')
  .patch(updateUser);

module.exports = router;
