const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

class AuthMiddleware {
  
  // Middleware para verificar API key en headers
  static async verifyApiKey(req, res, next) {
    try {
      const authHeader = req.get('Authorization');
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Token de autorización requerido' });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Token inválido' });
      }
      
      // Buscar API key en la base de datos
      const query = `
        SELECT as.*, p.slug as plugin_slug, p.name as plugin_name
        FROM authorized_sites as
        LEFT JOIN plugins p ON as.plugin_id = p.id
        WHERE as.api_key = $1 AND as.active = true
      `;
      
      const result = await db.query(query, [token]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'API key inválida' });
      }
      
      const site = result.rows[0];
      
      // Actualizar última verificación
      await db.query(
        'UPDATE authorized_sites SET last_check = CURRENT_TIMESTAMP WHERE id = $1',
        [site.id]
      );
      
      // Agregar información del sitio al request
      req.authorizedSite = site;
      req.pluginId = site.plugin_id;
      
      next();
    } catch (error) {
      console.error('Error verificando API key:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Middleware para verificar JWT de administrador
  static verifyAdminToken(req, res, next) {
    try {
      const authHeader = req.get('Authorization');
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Token de administrador requerido' });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Token inválido' });
      }
      
      // Verificar JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: 'Permisos de administrador requeridos' });
      }
      
      req.admin = decoded;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token inválido' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      
      console.error('Error verificando token admin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Middleware opcional - permite acceso sin autenticación pero registra sitio si tiene key
  static optionalAuth(req, res, next) {
    const authHeader = req.get('Authorization');
    
    if (!authHeader) {
      return next(); // Continuar sin autenticación
    }
    
    // Si hay header, verificar pero no fallar si es inválido
    AuthMiddleware.verifyApiKey(req, res, (error) => {
      if (error) {
        // Log del intento de autenticación fallido pero continuar
        console.warn('Intento de autenticación fallido:', authHeader.substring(0, 20) + '...');
      }
      next(); // Siempre continuar
    });
  }
  
  // Rate limiting básico por IP
  static rateLimitByIP(maxRequests = 100, windowMs = 15 * 60 * 1000) { // 100 req/15min
    const ipRequests = new Map();
    
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Limpiar requests antiguos
      if (ipRequests.has(ip)) {
        const requests = ipRequests.get(ip).filter(time => time > windowStart);
        ipRequests.set(ip, requests);
      } else {
        ipRequests.set(ip, []);
      }
      
      const requests = ipRequests.get(ip);
      
      if (requests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Demasiadas solicitudes',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      requests.push(now);
      next();
    };
  }
  
  // Rate limiting más estricto para endpoints administrativos
  static strictRateLimit(maxRequests = 10, windowMs = 60 * 1000) { // 10 req/min
    return AuthMiddleware.rateLimitByIP(maxRequests, windowMs);
  }
}

module.exports = AuthMiddleware;