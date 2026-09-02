const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const caseRoutes = require('./case.routes');
const documentRoutes = require('./document.routes');
const proBonoRoutes = require('./proBono.routes');
const watchRoutes = require('./watch.routes');
const analyticsRoutes = require('./analytics.routes');
const publicRoutes = require('./public.routes');

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: Date.now() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/cases', caseRoutes);
router.use('/documents', documentRoutes);
router.use('/pro-bono', proBonoRoutes);
router.use('/watch', watchRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/public', publicRoutes);

module.exports = router;
