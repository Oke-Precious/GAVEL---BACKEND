const express = require('express');
const { getUnrepresentedCases, claimCase, getMyClaimedCases } = require('../../controllers/proBonoController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('lawyer'));

router.get('/cases', getUnrepresentedCases);
router.post('/cases/:id/claim', claimCase);
router.get('/my-claimed', getMyClaimedCases);

module.exports = router;
