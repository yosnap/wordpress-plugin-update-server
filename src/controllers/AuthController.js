const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');

class AuthController {
  
  // Generar token de administrador
  async generateAdminToken(req, res) {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username y password requeridos' });
      }
      
      // Por simplicidad, usar credenciales de variables de entorno
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (!adminPassword) {
        return res.status(500).json({ error: 'Credenciales de admin no configuradas' });
      }
      
      // Verificar credenciales
      if (username !== adminUsername) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      
      // Verificar password (puede ser hash o plain text)
      let isValid = false;
      if (adminPassword.startsWith('$2b$')) {
        // Es un hash bcrypt
        isValid = await bcrypt.compare(password, adminPassword);
      } else {
        // Es texto plano (solo para desarrollo)
        isValid = password === adminPassword;
      }
      
      if (!isValid) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      
      // Generar JWT
      const token = jwt.sign(
        { 
          username,
          isAdmin: true,
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({
        token,
        expiresIn: '24h',
        message: 'Token generado exitosamente'
      });
      
    } catch (error) {
      console.error('Error generando token admin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Generar API key para un sitio/plugin
  async generateApiKey(req, res) {
    try {
      const { site_url, plugin_id } = req.body;
      
      if (!site_url) {
        return res.status(400).json({ error: 'URL del sitio requerida' });
      }
      
      // Verificar que el plugin existe
      if (plugin_id) {
        const pluginQuery = 'SELECT id FROM plugins WHERE id = $1 AND active = true';
        const pluginResult = await db.query(pluginQuery, [plugin_id]);
        
        if (pluginResult.rows.length === 0) {
          return res.status(404).json({ error: 'Plugin no encontrado' });
        }
      }
      
      // Generar API key segura
      const apiKey = this.generateSecureApiKey();
      
      // Insertar en base de datos
      const insertQuery = `
        INSERT INTO authorized_sites (site_url, api_key, plugin_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      
      const result = await db.query(insertQuery, [site_url, apiKey, plugin_id || null]);
      
      const site = result.rows[0];
      
      res.status(201).json({
        id: site.id,
        site_url: site.site_url,
        api_key: apiKey,
        plugin_id: site.plugin_id,
        created_at: site.created_at,
        message: 'API key generada exitosamente'
      });
      
    } catch (error) {
      if (error.code === '23505') { // Duplicate key
        return res.status(409).json({ error: 'Ya existe una API key para este sitio/plugin' });
      }
      
      console.error('Error generando API key:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Listar sitios autorizados
  async getAuthorizedSites(req, res) {
    try {
      const query = `
        SELECT as.id, as.site_url, as.plugin_id, as.active, as.created_at, as.last_check,
               p.slug as plugin_slug, p.name as plugin_name
        FROM authorized_sites as
        LEFT JOIN plugins p ON as.plugin_id = p.id
        ORDER BY as.created_at DESC
      `;
      
      const result = await db.query(query);
      
      // No devolver las API keys por seguridad
      const sites = result.rows.map(site => ({
        id: site.id,
        site_url: site.site_url,
        plugin_id: site.plugin_id,
        plugin_slug: site.plugin_slug,
        plugin_name: site.plugin_name,
        active: site.active,
        created_at: site.created_at,
        last_check: site.last_check,
        has_api_key: true
      }));
      
      res.json(sites);
      
    } catch (error) {
      console.error('Error obteniendo sitios autorizados:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Revocar API key
  async revokeApiKey(req, res) {
    try {
      const { siteId } = req.params;
      
      const query = `
        UPDATE authorized_sites 
        SET active = false 
        WHERE id = $1
        RETURNING site_url
      `;
      
      const result = await db.query(query, [siteId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Sitio no encontrado' });
      }
      
      res.json({
        message: 'API key revocada exitosamente',
        site_url: result.rows[0].site_url
      });
      
    } catch (error) {
      console.error('Error revocando API key:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Regenerar API key
  async regenerateApiKey(req, res) {
    try {
      const { siteId } = req.params;
      
      // Verificar que el sitio existe
      const checkQuery = 'SELECT * FROM authorized_sites WHERE id = $1';
      const checkResult = await db.query(checkQuery, [siteId]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Sitio no encontrado' });
      }
      
      // Generar nueva API key
      const newApiKey = this.generateSecureApiKey();
      
      // Actualizar en base de datos
      const updateQuery = `
        UPDATE authorized_sites 
        SET api_key = $1, active = true
        WHERE id = $2
        RETURNING site_url, plugin_id
      `;
      
      const result = await db.query(updateQuery, [newApiKey, siteId]);
      
      res.json({
        id: parseInt(siteId),
        site_url: result.rows[0].site_url,
        plugin_id: result.rows[0].plugin_id,
        api_key: newApiKey,
        message: 'API key regenerada exitosamente'
      });
      
    } catch (error) {
      console.error('Error regenerando API key:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Verificar estado de una API key
  async verifyApiKey(req, res) {
    try {
      const authHeader = req.get('Authorization');
      
      if (!authHeader) {
        return res.status(400).json({ error: 'Header de autorización requerido' });
      }
      
      const apiKey = authHeader.replace('Bearer ', '');
      
      const query = `
        SELECT as.*, p.slug as plugin_slug, p.name as plugin_name
        FROM authorized_sites as
        LEFT JOIN plugins p ON as.plugin_id = p.id
        WHERE as.api_key = $1
      `;
      
      const result = await db.query(query, [apiKey]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'API key no encontrada' });
      }
      
      const site = result.rows[0];
      
      res.json({
        valid: site.active,
        site_url: site.site_url,
        plugin_id: site.plugin_id,
        plugin_slug: site.plugin_slug,
        plugin_name: site.plugin_name,
        created_at: site.created_at,
        last_check: site.last_check,
        active: site.active
      });
      
    } catch (error) {
      console.error('Error verificando API key:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Generar API key segura
  generateSecureApiKey() {
    // Formato: prefix_32_caracteres_aleatorios
    const prefix = 'wpup';
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `${prefix}_${randomBytes}`;
  }
  
  // Hash de password para configuración inicial
  async hashPassword(req, res) {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: 'Password requerido' });
      }
      
      const hash = await bcrypt.hash(password, 12);
      
      res.json({
        hash,
        message: 'Agrega este hash a tu variable ADMIN_PASSWORD'
      });
      
    } catch (error) {
      console.error('Error hasheando password:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Estadísticas de autenticación
  async getAuthStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_sites,
          COUNT(*) FILTER (WHERE active = true) as active_sites,
          COUNT(*) FILTER (WHERE last_check > NOW() - INTERVAL '24 hours') as active_last_24h,
          COUNT(*) FILTER (WHERE last_check > NOW() - INTERVAL '7 days') as active_last_7d
        FROM authorized_sites
      `;
      
      const result = await db.query(statsQuery);
      
      res.json(result.rows[0]);
      
    } catch (error) {
      console.error('Error obteniendo estadísticas de auth:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}

module.exports = new AuthController();