const express = require('express');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const { subscribeToCase, unsubscribe } = require('../../controllers/watchController');

const router = express.Router();

const subscribeValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
];

router.post('/:caseHashId', subscribeValidation, validate, subscribeToCase);
router.delete('/:idOrToken', unsubscribe);

module.exports = router;
