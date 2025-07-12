const express = require('express');
const router = express.Router();
const PluginController = require('../controllers/PluginController');

// Listar todos los plugins
router.get('/', PluginController.getAllPlugins);

// Obtener plugin específico por slug
router.get('/:slug', PluginController.getPlugin);

// Crear nuevo plugin
router.post('/', PluginController.createPlugin);

// Actualizar plugin
router.put('/:slug', PluginController.updatePlugin);

// Desactivar plugin
router.delete('/:slug', PluginController.deletePlugin);

// Estadísticas de un plugin
router.get('/:slug/stats', PluginController.getPluginStats);

module.exports = router;