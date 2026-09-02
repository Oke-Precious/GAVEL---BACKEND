const express = require('express');
const { deleteDocument } = require('../../controllers/documentController');
const { protect } = require('../../middleware/auth');

const router = express.Router();

router.use(protect);

router.delete('/:id', deleteDocument);

module.exports = router;
