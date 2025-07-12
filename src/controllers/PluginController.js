const db = require('../config/database');

class PluginController {
  
  // Listar todos los plugins
  async getAllPlugins(req, res) {
    try {
      const query = `
        SELECT p.*, 
               pv.version as latest_version,
               pv.created_at as latest_release,
               (SELECT COUNT(*) FROM downloads d 
                JOIN plugin_versions pv2 ON d.version_id = pv2.id 
                WHERE pv2.plugin_id = p.id) as total_downloads
        FROM plugins p
        LEFT JOIN plugin_versions pv ON p.id = pv.plugin_id
        WHERE p.active = true
        AND pv.created_at = (
          SELECT MAX(created_at) 
          FROM plugin_versions pv2 
          WHERE pv2.plugin_id = p.id 
          AND pv2.is_prerelease = false
        )
        ORDER BY p.name
      `;
      
      const result = await db.query(query);
      res.json(result.rows);
    } catch (error) {
      console.error('Error obteniendo plugins:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener plugin específico
  async getPlugin(req, res) {
    try {
      const { slug } = req.params;
      
      const query = `
        SELECT p.*, 
               array_agg(
                 json_build_object(
                   'version', pv.version,
                   'created_at', pv.created_at,
                   'changelog', pv.changelog,
                   'is_prerelease', pv.is_prerelease,
                   'download_count', (
                     SELECT COUNT(*) FROM downloads d WHERE d.version_id = pv.id
                   )
                 ) ORDER BY pv.created_at DESC
               ) as versions
        FROM plugins p
        LEFT JOIN plugin_versions pv ON p.id = pv.plugin_id
        WHERE p.slug = $1 AND p.active = true
        GROUP BY p.id
      `;
      
      const result = await db.query(query, [slug]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plugin no encontrado' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error obteniendo plugin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nuevo plugin
  async createPlugin(req, res) {
    try {
      const {
        slug,
        name,
        description,
        author,
        github_repo,
        github_owner,
        homepage,
        requires_wp,
        tested_wp,
        requires_php
      } = req.body;

      if (!slug || !name || !github_repo || !github_owner) {
        return res.status(400).json({
          error: 'Se requieren: slug, name, github_repo, github_owner'
        });
      }

      const insertQuery = `
        INSERT INTO plugins (slug, name, description, author, github_repo, github_owner, homepage, requires_wp, tested_wp, requires_php)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        slug, name, description, author, github_repo, github_owner,
        homepage, requires_wp, tested_wp, requires_php
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Duplicate key
        return res.status(409).json({ error: 'Plugin con este slug ya existe' });
      }
      console.error('Error creando plugin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar plugin
  async updatePlugin(req, res) {
    try {
      const { slug } = req.params;
      const updates = req.body;
      
      // Construir query dinámicamente
      const allowedFields = ['name', 'description', 'author', 'homepage', 'requires_wp', 'tested_wp', 'requires_php'];
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = $${paramCount++}`);
          values.push(updates[key]);
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
      }

      values.push(slug); // Para el WHERE
      const query = `
        UPDATE plugins 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE slug = $${paramCount} AND active = true
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plugin no encontrado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error actualizando plugin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Desactivar plugin (soft delete)
  async deletePlugin(req, res) {
    try {
      const { slug } = req.params;
      
      const query = `
        UPDATE plugins 
        SET active = false, updated_at = CURRENT_TIMESTAMP
        WHERE slug = $1 AND active = true
        RETURNING *
      `;

      const result = await db.query(query, [slug]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plugin no encontrado' });
      }

      res.json({ message: 'Plugin desactivado exitosamente' });
    } catch (error) {
      console.error('Error desactivando plugin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Estadísticas del plugin
  async getPluginStats(req, res) {
    try {
      const { slug } = req.params;
      
      const statsQuery = `
        SELECT 
          p.name,
          p.slug,
          COUNT(DISTINCT pv.id) as total_versions,
          COUNT(d.id) as total_downloads,
          COUNT(DISTINCT d.ip_address) as unique_downloads,
          COUNT(DISTINCT DATE(d.downloaded_at)) as active_days,
          MAX(d.downloaded_at) as last_download,
          AVG(pv.file_size) as avg_file_size
        FROM plugins p
        LEFT JOIN plugin_versions pv ON p.id = pv.plugin_id
        LEFT JOIN downloads d ON pv.id = d.version_id
        WHERE p.slug = $1 AND p.active = true
        GROUP BY p.id, p.name, p.slug
      `;

      const result = await db.query(statsQuery, [slug]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plugin no encontrado' });
      }

      // Descargas por versión
      const versionStatsQuery = `
        SELECT pv.version, COUNT(d.id) as downloads
        FROM plugin_versions pv
        LEFT JOIN downloads d ON pv.id = d.version_id
        JOIN plugins p ON pv.plugin_id = p.id
        WHERE p.slug = $1
        GROUP BY pv.version
        ORDER BY pv.created_at DESC
      `;

      const versionStats = await db.query(versionStatsQuery, [slug]);

      res.json({
        ...result.rows[0],
        version_stats: versionStats.rows
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}

module.exports = new PluginController();