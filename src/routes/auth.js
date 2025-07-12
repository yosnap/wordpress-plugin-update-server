const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const AuthMiddleware = require('../middleware/auth');

// Ruta pública para generar token de admin
router.post('/admin/login', AuthMiddleware.strictRateLimit(5, 60000), AuthController.generateAdminToken);

// Ruta pública para hashear passwords (solo desarrollo)
if (process.env.NODE_ENV === 'development') {
  router.post('/hash-password', AuthController.hashPassword);
}

// Rutas protegidas con autenticación de admin
router.use(AuthMiddleware.verifyAdminToken);

// Gestión de API keys
router.post('/api-keys', AuthController.generateApiKey);
router.get('/api-keys', AuthController.getAuthorizedSites);
router.delete('/api-keys/:siteId', AuthController.revokeApiKey);
router.post('/api-keys/:siteId/regenerate', AuthController.regenerateApiKey);

// Verificación de API keys
router.post('/verify', AuthController.verifyApiKey);

// Estadísticas
router.get('/stats', AuthController.getAuthStats);

module.exports = router;