const express = require('express');
const { getPublicCase, getScorecard, getBacklogMap, getTrends } = require('../../controllers/publicController');

const router = express.Router();

// No auth required, heavily sanitized controller logic
router.get('/cases/:caseHashId', getPublicCase);
router.get('/scorecard', getScorecard);
router.get('/backlog-map', getBacklogMap);
router.get('/trends', getTrends);

module.exports = router;
