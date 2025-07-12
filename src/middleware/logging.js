const logger = require('../services/LoggerService');

class LoggingMiddleware {
  
  // Middleware para logging de requests HTTP
  static accessLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Interceptar el método end de response para capturar cuando termine
      const originalEnd = res.end;
      res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Log del request
        logger.logAccess(req, res, responseTime);
        
        // Llamar al método original
        originalEnd.apply(this, args);
      };
      
      next();
    };
  }
  
  // Middleware para capturar errores no manejados
  static errorLogger() {
    return (err, req, res, next) => {
      // Log del error
      logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body,
        params: req.params,
        query: req.query
      });
      
      next(err);
    };
  }
  
  // Middleware específico para logging de autenticación
  static authLogger() {
    return (req, res, next) => {
      const originalJson = res.json;
      
      res.json = function(data) {
        // Si es un endpoint de login, log el intento
        if (req.path === '/api/auth/admin/login') {
          const success = res.statusCode === 200;
          logger.logAdminLogin(
            req.body?.username,
            req.ip,
            req.get('User-Agent'),
            success,
            success ? null : data?.error
          );
        }
        
        // Si es generación de API key, log el evento
        if (req.path === '/api/auth/api-keys' && req.method === 'POST' && res.statusCode === 201) {
          logger.logApiKeyGenerated(
            req.body?.site_url,
            req.body?.plugin_id,
            req.admin?.username,
            req.ip
          );
        }
        
        originalJson.call(this, data);
      };
      
      next();
    };
  }
  
  // Middleware para logging de uso de API keys
  static apiKeyUsageLogger() {
    return (req, res, next) => {
      // Si hay un sitio autorizado, significa que se usó API key
      if (req.authorizedSite) {
        logger.logApiKeyUsage(
          req.authorizedSite.api_key,
          req.authorizedSite.site_url,
          req.originalUrl,
          req.ip
        );
      }
      
      next();
    };
  }
  
  // Middleware para logging de rate limiting
  static rateLimitLogger() {
    return (req, res, next) => {
      const originalStatus = res.status;
      
      res.status = function(code) {
        if (code === 429) {
          logger.logRateLimitExceeded(
            req.ip,
            req.originalUrl,
            'Rate limit exceeded'
          );
        }
        
        return originalStatus.call(this, code);
      };
      
      next();
    };
  }
  
  // Middleware para logging de descargas de plugins
  static downloadLogger() {
    return (req, res, next) => {
      // Solo para endpoints de descarga
      if (req.path.startsWith('/api/updates/download/')) {
        const originalSendFile = res.sendFile;
        const originalRedirect = res.redirect;
        
        res.sendFile = function(...args) {
          // Log de descarga exitosa
          logger.logPluginDownload(
            req.params.slug,
            req.params.version,
            req.ip,
            req.get('User-Agent'),
            req.get('X-WP-Version')
          );
          
          return originalSendFile.apply(this, args);
        };
        
        res.redirect = function(...args) {
          // Log de redirección a GitHub
          logger.logPluginDownload(
            req.params.slug,
            req.params.version,
            req.ip,
            req.get('User-Agent'),
            req.get('X-WP-Version')
          );
          
          return originalRedirect.apply(this, args);
        };
      }
      
      next();
    };
  }
  
  // Middleware para logging de verificaciones de actualización
  static updateCheckLogger() {
    return (req, res, next) => {
      // Solo para endpoints de verificación de actualización
      if (req.path.startsWith('/api/updates/check/')) {
        const originalJson = res.json;
        
        res.json = function(data) {
          // Log de verificación de actualización
          logger.logUpdateCheck(
            req.params.slug,
            req.query.version,
            data.new_version || 'current',
            !!data.new_version,
            req.ip
          );
          
          return originalJson.call(this, data);
        };
      }
      
      next();
    };
  }
  
  // Middleware para logging de webhooks
  static webhookLogger() {
    return (req, res, next) => {
      if (req.path.startsWith('/api/webhooks/')) {
        // Log de webhook recibido
        logger.logWebhook('webhook_received', {
          path: req.path,
          method: req.method,
          headers: {
            'x-github-event': req.get('X-GitHub-Event'),
            'x-hub-signature-256': req.get('X-Hub-Signature-256') ? 'present' : 'missing'
          },
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        // Interceptar respuesta para log de resultado
        const originalJson = res.json;
        res.json = function(data) {
          logger.logWebhook('webhook_response', {
            path: req.path,
            status: res.statusCode,
            response: data,
            processingTime: Date.now() - req.startTime
          });
          
          return originalJson.call(this, data);
        };
        
        req.startTime = Date.now();
      }
      
      next();
    };
  }
  
  // Middleware para capturar métricas de performance
  static performanceLogger() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // Log métricas de performance para endpoints críticos
        if (req.path.startsWith('/api/')) {
          logger.debug('performance_metrics', {
            method: req.method,
            path: req.path,
            duration: `${duration.toFixed(2)}ms`,
            memoryDelta: {
              rss: endMemory.rss - startMemory.rss,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed
            },
            status: res.statusCode
          });
        }
      });
      
      next();
    };
  }
}

module.exports = LoggingMiddleware;