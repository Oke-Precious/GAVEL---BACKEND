const express = require('express');
const { getOverview, getHeatmap, getTrends } = require('../../controllers/analyticsController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('admin')); // Only admins access system analytics

router.get('/overview', getOverview);
router.get('/heatmap', getHeatmap);
router.get('/trends', getTrends);

module.exports = router;
