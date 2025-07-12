const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const LoggingMiddleware = require('./middleware/logging');
const logger = require('./services/LoggerService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use(LoggingMiddleware.accessLogger());
app.use(LoggingMiddleware.performanceLogger());
app.use(LoggingMiddleware.rateLimitLogger());

// Servir archivos estáticos (plugins descargados)
app.use('/downloads', express.static(path.join(__dirname, '../uploads')));

// Rutas principales
app.use('/api/plugins', require('./routes/plugins'));
app.use('/api/updates', LoggingMiddleware.updateCheckLogger(), LoggingMiddleware.downloadLogger(), require('./routes/updates'));
app.use('/api/webhooks', LoggingMiddleware.webhookLogger(), require('./routes/webhooks'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', LoggingMiddleware.authLogger(), require('./routes/auth'));
app.use('/api/monitoring', require('./routes/monitoring'));

// Ruta de salud del servidor
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: 'Servidor de Actualizaciones WordPress',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      plugins: '/api/plugins',
      updates: '/api/updates',
      webhooks: '/api/webhooks',
      admin: '/api/admin',
      auth: '/api/auth',
      monitoring: '/api/monitoring'
    }
  });
});

// Manejo de errores
app.use(LoggingMiddleware.errorLogger());
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({ 
    error: statusCode === 500 ? 'Error interno del servidor' : err.message,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid
  });
  
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📋 Monitoring: http://localhost:${PORT}/api/monitoring/health`);
});