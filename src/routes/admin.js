const express = require('express');
const router = express.Router();
const GitHubService = require('../services/GitHubService');
const AuthMiddleware = require('../middleware/auth');

// Proteger todas las rutas de admin con autenticación
router.use(AuthMiddleware.verifyAdminToken);

// Sincronizar releases de un plugin específico
router.post('/sync/:pluginId', async (req, res) => {
  try {
    const { pluginId } = req.params;
    const result = await GitHubService.syncPluginReleases(parseInt(pluginId));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sincronizar todos los plugins
router.post('/sync-all', async (req, res) => {
  try {
    const results = await GitHubService.syncAllPlugins();
    res.json({
      message: 'Sincronización completada',
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar rate limit de GitHub
router.get('/github/rate-limit', async (req, res) => {
  try {
    const rateLimit = await GitHubService.checkRateLimit();
    res.json(rateLimit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Información del repositorio
router.get('/github/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const repoInfo = await GitHubService.getRepository(owner, repo);
    res.json(repoInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;