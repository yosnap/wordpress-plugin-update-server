const logger = require('../services/LoggerService');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

class MonitoringController {
  
  // Dashboard de métricas generales
  async getDashboard(req, res) {
    try {
      const stats = await this.getSystemStats();
      const dbStats = await this.getDatabaseStats();
      const logStats = await logger.getLogStats(24);
      const apiStats = await this.getApiStats();
      
      res.json({
        system: stats,
        database: dbStats,
        logs: logStats,
        api: apiStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting dashboard data', { error: error.message });
      res.status(500).json({ error: 'Error obteniendo datos del dashboard' });
    }
  }
  
  // Estadísticas del sistema
  async getSystemStats() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    };
  }
  
  // Estadísticas de la base de datos
  async getDatabaseStats() {
    try {
      const queries = [
        'SELECT COUNT(*) as total_plugins FROM plugins WHERE active = true',
        'SELECT COUNT(*) as total_versions FROM plugin_versions',
        'SELECT COUNT(*) as total_downloads FROM downloads WHERE downloaded_at > NOW() - INTERVAL \'24 hours\'',
        'SELECT COUNT(*) as total_sites FROM authorized_sites WHERE active = true',
        'SELECT COUNT(*) as active_sites_24h FROM authorized_sites WHERE last_check > NOW() - INTERVAL \'24 hours\''
      ];
      
      const results = await Promise.all(
        queries.map(query => db.query(query))
      );
      
      return {
        totalPlugins: parseInt(results[0].rows[0].total_plugins),
        totalVersions: parseInt(results[1].rows[0].total_versions),
        downloads24h: parseInt(results[2].rows[0].total_downloads),
        totalSites: parseInt(results[3].rows[0].total_sites),
        activeSites24h: parseInt(results[4].rows[0].active_sites_24h)
      };
    } catch (error) {
      logger.error('Error getting database stats', { error: error.message });
      return null;
    }
  }
  
  // Estadísticas de la API
  async getApiStats() {
    try {
      // Obtener estadísticas de los últimos 7 días
      const downloadsQuery = `
        SELECT 
          DATE(downloaded_at) as date,
          COUNT(*) as downloads,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM downloads 
        WHERE downloaded_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(downloaded_at)
        ORDER BY date DESC
      `;
      
      const topPluginsQuery = `
        SELECT 
          p.slug,
          p.name,
          COUNT(d.id) as download_count
        FROM downloads d
        JOIN plugin_versions pv ON d.version_id = pv.id
        JOIN plugins p ON pv.plugin_id = p.id
        WHERE d.downloaded_at > NOW() - INTERVAL '24 hours'
        GROUP BY p.id, p.slug, p.name
        ORDER BY download_count DESC
        LIMIT 10
      `;
      
      const [downloadsResult, topPluginsResult] = await Promise.all([
        db.query(downloadsQuery),
        db.query(topPluginsQuery)
      ]);
      
      return {
        downloadsLast7Days: downloadsResult.rows,
        topPlugins24h: topPluginsResult.rows
      };
    } catch (error) {
      logger.error('Error getting API stats', { error: error.message });
      return null;
    }
  }
  
  // Health check detallado
  async getHealthCheck(req, res) {
    try {
      const checks = {
        database: await this.checkDatabase(),
        github: await this.checkGitHubApi(),
        filesystem: await this.checkFilesystem(),
        memory: await this.checkMemory(),
        logs: await this.checkLogsDirectory()
      };
      
      const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
      
      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        checks,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error in health check', { error: error.message });
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Verificar conexión a base de datos
  async checkDatabase() {
    try {
      const result = await db.query('SELECT 1');
      return {
        status: 'healthy',
        responseTime: Date.now(),
        details: 'Database connection successful'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: 'Database connection failed'
      };
    }
  }
  
  // Verificar GitHub API
  async checkGitHubApi() {
    try {
      const axios = require('axios');
      const headers = {
        'User-Agent': 'WordPress-Plugin-Update-Server/1.0'
      };
      
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }
      
      const start = Date.now();
      const response = await axios.get('https://api.github.com/rate_limit', {
        headers,
        timeout: 5000
      });
      
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        details: `Rate limit: ${response.data.rate.remaining}/${response.data.rate.limit}`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: 'GitHub API connection failed'
      };
    }
  }
  
  // Verificar sistema de archivos
  async checkFilesystem() {
    try {
      const uploadsDir = path.join(__dirname, '../../uploads');
      
      // Verificar que el directorio existe y es escribible
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Test de escritura
      const testFile = path.join(uploadsDir, '.health-check');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      // Verificar espacio disponible
      const stats = fs.statSync(uploadsDir);
      
      return {
        status: 'healthy',
        details: 'Filesystem accessible and writable',
        uploadsDirectory: uploadsDir
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: 'Filesystem check failed'
      };
    }
  }
  
  // Verificar uso de memoria
  async checkMemory() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;
    
    const status = memoryUsagePercent > 90 ? 'warning' : 'healthy';
    
    return {
      status,
      details: `Memory usage: ${memoryUsagePercent.toFixed(1)}%`,
      heapUsed: `${heapUsedMB.toFixed(1)}MB`,
      heapTotal: `${heapTotalMB.toFixed(1)}MB`
    };
  }
  
  // Verificar directorio de logs
  async checkLogsDirectory() {
    try {
      const logsDir = path.join(__dirname, '../../logs');
      
      if (!fs.existsSync(logsDir)) {
        return {
          status: 'warning',
          details: 'Logs directory does not exist'
        };
      }
      
      const files = fs.readdirSync(logsDir);
      const totalSize = files.reduce((size, file) => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return size + stats.size;
      }, 0);
      
      const totalSizeMB = totalSize / 1024 / 1024;
      
      return {
        status: 'healthy',
        details: `${files.length} log files, ${totalSizeMB.toFixed(1)}MB total`,
        files: files.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: 'Logs directory check failed'
      };
    }
  }
  
  // Métricas en tiempo real (para dashboards)
  async getRealTimeMetrics(req, res) {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        activeConnections: await this.getActiveConnections(),
        recentActivity: await this.getRecentActivity()
      };
      
      res.json(metrics);
    } catch (error) {
      logger.error('Error getting real-time metrics', { error: error.message });
      res.status(500).json({ error: 'Error obteniendo métricas' });
    }
  }
  
  // Obtener conexiones activas (aproximación)
  async getActiveConnections() {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as active_checks
        FROM authorized_sites 
        WHERE last_check > NOW() - INTERVAL '5 minutes'
      `);
      
      return parseInt(result.rows[0].active_checks);
    } catch (error) {
      return 0;
    }
  }
  
  // Obtener actividad reciente
  async getRecentActivity() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE downloaded_at > NOW() - INTERVAL '1 hour') as downloads_1h,
          COUNT(*) FILTER (WHERE downloaded_at > NOW() - INTERVAL '5 minutes') as downloads_5m
        FROM downloads
      `);
      
      return result.rows[0];
    } catch (error) {
      return { downloads_1h: 0, downloads_5m: 0 };
    }
  }
  
  // Limpiar logs antiguos (endpoint administrativo)
  async cleanLogs(req, res) {
    try {
      const { days = 30 } = req.query;
      
      logger.cleanOldLogs(parseInt(days));
      
      res.json({
        message: `Logs older than ${days} days cleaned`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error cleaning logs', { error: error.message });
      res.status(500).json({ error: 'Error limpiando logs' });
    }
  }
}

module.exports = new MonitoringController();