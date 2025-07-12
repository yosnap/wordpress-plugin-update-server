const express = require('express');
const router = express.Router();
const UpdateController = require('../controllers/UpdateController');
const AuthMiddleware = require('../middleware/auth');

// Aplicar rate limiting a todos los endpoints de updates
router.use(AuthMiddleware.rateLimitByIP(200, 15 * 60 * 1000)); // 200 req/15min

// Verificar actualizaciones para un plugin específico
// GET /api/updates/check/:slug?version=1.0.0
router.get('/check/:slug', AuthMiddleware.optionalAuth, UpdateController.checkUpdate);

// Descargar versión específica de un plugin
// GET /api/updates/download/:slug/:version
router.get('/download/:slug/:version', AuthMiddleware.optionalAuth, UpdateController.downloadPlugin);

// Obtener información completa de un plugin
// GET /api/updates/info/:slug
router.get('/info/:slug', AuthMiddleware.optionalAuth, UpdateController.getPluginInfo);

// Endpoint de verificación masiva (para múltiples plugins)
// POST /api/updates/check-multiple
router.post('/check-multiple', async (req, res) => {
  try {
    const { plugins } = req.body;
    
    if (!Array.isArray(plugins)) {
      return res.status(400).json({
        error: 'Se requiere un array de plugins'
      });
    }

    const results = {};
    
    for (const plugin of plugins) {
      if (!plugin.slug || !plugin.version) {
        results[plugin.slug || 'unknown'] = {
          error: 'Slug y versión requeridos'
        };
        continue;
      }

      try {
        // Simular request para reutilizar lógica existente
        const mockReq = {
          params: { slug: plugin.slug },
          query: { version: plugin.version },
          ip: req.ip,
          get: (header) => req.get(header)
        };

        const mockRes = {
          json: (data) => {
            results[plugin.slug] = data;
          },
          status: () => mockRes
        };

        await UpdateController.checkUpdate(mockReq, mockRes);
      } catch (error) {
        results[plugin.slug] = {
          error: 'Error verificando actualización'
        };
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error en verificación múltiple:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;