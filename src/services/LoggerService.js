const winston = require('winston');
const path = require('path');
const fs = require('fs');

class LoggerService {
  constructor() {
    // Crear directorio de logs si no existe
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Configurar formatos
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      })
    );

    // Logger principal de aplicación
    this.appLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({ 
          filename: path.join(logsDir, 'app.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({ 
          filename: path.join(logsDir, 'error.log'), 
          level: 'error',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });

    // Logger de seguridad
    this.securityLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({ 
          filename: path.join(logsDir, 'security.log'),
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });

    // Logger de acceso (requests HTTP)
    this.accessLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({ 
          filename: path.join(logsDir, 'access.log'),
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });

    // Logger de GitHub webhooks
    this.webhookLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({ 
          filename: path.join(logsDir, 'webhooks.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 3
        })
      ]
    });

    // Agregar console en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      this.appLogger.add(new winston.transports.Console({ format: consoleFormat }));
    }
  }

  // Logs de aplicación general
  info(message, meta = {}) {
    this.appLogger.info(message, meta);
  }

  error(message, meta = {}) {
    this.appLogger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.appLogger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.appLogger.debug(message, meta);
  }

  // Logs de seguridad
  logSecurity(event, details = {}) {
    this.securityLogger.info(event, {
      ...details,
      timestamp: new Date().toISOString(),
      severity: details.severity || 'info'
    });
  }

  // Logs de acceso HTTP
  logAccess(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: responseTime + 'ms',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      contentLength: res.get('Content-Length'),
      timestamp: new Date().toISOString()
    };

    // Agregar información de autenticación si existe
    if (req.authorizedSite) {
      logData.authorizedSite = req.authorizedSite.site_url;
      logData.pluginId = req.authorizedSite.plugin_id;
    }

    if (req.admin) {
      logData.adminUser = req.admin.username;
    }

    this.accessLogger.info('HTTP Request', logData);
  }

  // Logs de webhooks de GitHub
  logWebhook(event, payload = {}) {
    this.webhookLogger.info(event, {
      ...payload,
      timestamp: new Date().toISOString()
    });
  }

  // Log de intento de login de admin
  logAdminLogin(username, ip, userAgent, success, reason = null) {
    this.logSecurity('admin_login_attempt', {
      username,
      ip,
      userAgent,
      success,
      reason,
      severity: success ? 'info' : 'warning'
    });
  }

  // Log de generación de API key
  logApiKeyGenerated(siteUrl, pluginId, adminUser, ip) {
    this.logSecurity('api_key_generated', {
      siteUrl,
      pluginId,
      adminUser,
      ip,
      severity: 'info'
    });
  }

  // Log de uso de API key
  logApiKeyUsage(apiKey, siteUrl, endpoint, ip) {
    this.logSecurity('api_key_usage', {
      apiKey: apiKey.substring(0, 10) + '...', // Solo mostrar prefijo
      siteUrl,
      endpoint,
      ip,
      severity: 'info'
    });
  }

  // Log de intento de API key inválida
  logInvalidApiKey(apiKey, endpoint, ip) {
    this.logSecurity('invalid_api_key', {
      apiKey: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
      endpoint,
      ip,
      severity: 'warning'
    });
  }

  // Log de rate limiting
  logRateLimitExceeded(ip, endpoint, limit) {
    this.logSecurity('rate_limit_exceeded', {
      ip,
      endpoint,
      limit,
      severity: 'warning'
    });
  }

  // Log de nuevo release procesado
  logReleaseProcessed(pluginSlug, version, githubRepo, success, error = null) {
    const logData = {
      pluginSlug,
      version,
      githubRepo,
      success,
      severity: success ? 'info' : 'error'
    };

    if (error) {
      logData.error = error;
    }

    this.logWebhook('release_processed', logData);
  }

  // Log de descarga de plugin
  logPluginDownload(pluginSlug, version, ip, userAgent, wpVersion) {
    this.info('plugin_download', {
      pluginSlug,
      version,
      ip,
      userAgent,
      wpVersion
    });
  }

  // Log de verificación de actualización
  logUpdateCheck(pluginSlug, currentVersion, latestVersion, hasUpdate, ip) {
    this.info('update_check', {
      pluginSlug,
      currentVersion,
      latestVersion,
      hasUpdate,
      ip
    });
  }

  // Método para obtener estadísticas de logs
  async getLogStats(hours = 24) {
    // Este método requeriría parsear los archivos de log
    // Por simplicidad, devolvemos estructura básica
    return {
      period: `${hours} hours`,
      appLogs: await this.countLogLines('app.log'),
      securityLogs: await this.countLogLines('security.log'),
      accessLogs: await this.countLogLines('access.log'),
      webhookLogs: await this.countLogLines('webhooks.log'),
      errorLogs: await this.countLogLines('error.log')
    };
  }

  // Método auxiliar para contar líneas en archivo de log
  async countLogLines(filename) {
    try {
      const filePath = path.join(__dirname, '../../logs', filename);
      if (!fs.existsSync(filePath)) return 0;

      const data = fs.readFileSync(filePath, 'utf8');
      return data.split('\n').filter(line => line.trim().length > 0).length;
    } catch (error) {
      return 0;
    }
  }

  // Limpiar logs antiguos (para mantenimiento)
  cleanOldLogs(daysToKeep = 30) {
    const logsDir = path.join(__dirname, '../../logs');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const files = fs.readdirSync(logsDir);
      
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          this.info(`Deleted old log file: ${file}`);
        }
      });
    } catch (error) {
      this.error('Error cleaning old logs', { error: error.message });
    }
  }
}

// Singleton
const loggerService = new LoggerService();
module.exports = loggerService;