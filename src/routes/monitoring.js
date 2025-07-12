const express = require('express');
const router = express.Router();
const MonitoringController = require('../controllers/MonitoringController');
const AuthMiddleware = require('../middleware/auth');

// Health check público (sin autenticación)
router.get('/health', MonitoringController.getHealthCheck);

// Métricas en tiempo real públicas (básicas)
router.get('/metrics', MonitoringController.getRealTimeMetrics);

// Proteger rutas administrativas
router.use(AuthMiddleware.verifyAdminToken);

// Dashboard completo de monitoreo
router.get('/dashboard', MonitoringController.getDashboard);

// Limpiar logs antiguos
router.post('/logs/clean', MonitoringController.cleanLogs);

module.exports = router;