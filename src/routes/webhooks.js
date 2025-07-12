const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/WebhookController');

// Webhook principal de GitHub
router.post('/github', WebhookController.handleGitHubWebhook);

// Test manual del webhook
router.post('/test', WebhookController.testWebhook);

// Endpoint para verificar configuración
router.get('/status', (req, res) => {
  res.json({
    webhook_configured: !!process.env.GITHUB_WEBHOOK_SECRET,
    github_token_configured: !!process.env.GITHUB_TOKEN,
    server_url: process.env.SERVER_URL,
    upload_dir: process.env.UPLOAD_DIR || './uploads'
  });
});

module.exports = router;