const db = require('../config/database');
const semver = require('semver');

class UpdateController {
  
  // Verificar actualizaciones para un plugin específico
  async checkUpdate(req, res) {
    try {
      const { slug } = req.params;
      const { version: currentVersion } = req.query;
      
      if (!slug || !currentVersion) {
        return res.status(400).json({
          error: 'Se requiere slug del plugin y versión actual'
        });
      }

      // Buscar el plugin y su última versión
      const pluginQuery = `
        SELECT p.*, pv.version, pv.download_url, pv.changelog, pv.file_size
        FROM plugins p
        LEFT JOIN plugin_versions pv ON p.id = pv.plugin_id
        WHERE p.slug = $1 AND p.active = true AND pv.is_prerelease = false
        ORDER BY pv.created_at DESC
        LIMIT 1
      `;
      
      const result = await db.query(pluginQuery, [slug]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Plugin no encontrado'
        });
      }

      const plugin = result.rows[0];
      const latestVersion = plugin.version;

      // Comparar versiones usando semver
      const hasUpdate = semver.gt(latestVersion, currentVersion);

      if (!hasUpdate) {
        return res.json({
          slug,
          version: currentVersion,
          up_to_date: true,
          message: 'Plugin actualizado'
        });
      }

      // Registrar consulta de actualización
      await this.logUpdateCheck(plugin.id, req);

      // Respuesta compatible con WordPress Update API
      return res.json({
        slug,
        plugin: `${slug}/${slug}.php`,
        new_version: latestVersion,
        url: plugin.homepage || `${process.env.SERVER_URL}/plugins/${slug}`,
        package: `${process.env.SERVER_URL}/api/updates/download/${slug}/${latestVersion}`,
        icons: {
          '1x': `${process.env.SERVER_URL}/icons/${slug}-128x128.png`,
          '2x': `${process.env.SERVER_URL}/icons/${slug}-256x256.png`
        },
        banners: {
          low: `${process.env.SERVER_URL}/banners/${slug}-772x250.png`,
          high: `${process.env.SERVER_URL}/banners/${slug}-1544x500.png`
        },
        requires: plugin.requires_wp || '5.0',
        tested: plugin.tested_wp || '6.3',
        requires_php: plugin.requires_php || '7.4',
        sections: {
          description: plugin.description || '',
          changelog: plugin.changelog || 'Consultar GitHub para detalles'
        },
        upgrade_notice: `Nueva versión ${latestVersion} disponible`
      });

    } catch (error) {
      console.error('Error verificando actualización:', error);
      res.status(500).json({
        error: 'Error interno del servidor'
      });
    }
  }

  // Descargar plugin específico
  async downloadPlugin(req, res) {
    try {
      const { slug, version } = req.params;
      
      const versionQuery = `
        SELECT pv.*, p.name, p.slug
        FROM plugin_versions pv
        JOIN plugins p ON p.id = pv.plugin_id
        WHERE p.slug = $1 AND pv.version = $2 AND p.active = true
      `;
      
      const result = await db.query(versionQuery, [slug, version]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Versión de plugin no encontrada'
        });
      }

      const pluginVersion = result.rows[0];

      // Registrar descarga
      await this.logDownload(pluginVersion.plugin_id, pluginVersion.id, req);

      // Si existe archivo local, servirlo
      if (pluginVersion.file_path) {
        const path = require('path');
        const fs = require('fs');
        const filePath = path.join(__dirname, '../../uploads', pluginVersion.file_path);
        
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Disposition', `attachment; filename="${slug}-${version}.zip"`);
          res.setHeader('Content-Type', 'application/zip');
          return res.sendFile(filePath);
        }
      }

      // Si no existe archivo local, redirigir a GitHub
      if (pluginVersion.download_url) {
        return res.redirect(pluginVersion.download_url);
      }

      res.status(404).json({
        error: 'Archivo no disponible'
      });

    } catch (error) {
      console.error('Error descargando plugin:', error);
      res.status(500).json({
        error: 'Error interno del servidor'
      });
    }
  }

  // Información detallada del plugin
  async getPluginInfo(req, res) {
    try {
      const { slug } = req.params;
      
      const infoQuery = `
        SELECT p.*, 
               array_agg(
                 json_build_object(
                   'version', pv.version,
                   'release_date', pv.created_at,
                   'changelog', pv.changelog,
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
      
      const result = await db.query(infoQuery, [slug]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Plugin no encontrado'
        });
      }

      const plugin = result.rows[0];
      
      // Estadísticas de descarga
      const statsQuery = `
        SELECT COUNT(*) as total_downloads,
               COUNT(DISTINCT DATE(downloaded_at)) as active_days
        FROM downloads d
        JOIN plugin_versions pv ON d.version_id = pv.id
        WHERE pv.plugin_id = $1
      `;
      
      const stats = await db.query(statsQuery, [plugin.id]);

      res.json({
        ...plugin,
        stats: stats.rows[0],
        last_updated: plugin.updated_at
      });

    } catch (error) {
      console.error('Error obteniendo información del plugin:', error);
      res.status(500).json({
        error: 'Error interno del servidor'
      });
    }
  }

  // Registrar consulta de actualización
  async logUpdateCheck(pluginId, req) {
    try {
      const logQuery = `
        UPDATE plugins SET updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `;
      await db.query(logQuery, [pluginId]);
    } catch (error) {
      console.error('Error logging update check:', error);
    }
  }

  // Registrar descarga
  async logDownload(pluginId, versionId, req) {
    try {
      const downloadQuery = `
        INSERT INTO downloads (plugin_id, version_id, ip_address, user_agent, wp_version, php_version, site_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      const wpVersion = req.get('X-WP-Version');
      const phpVersion = req.get('X-PHP-Version');
      const siteUrl = req.get('X-Site-URL');

      await db.query(downloadQuery, [
        pluginId, 
        versionId, 
        ipAddress, 
        userAgent, 
        wpVersion, 
        phpVersion, 
        siteUrl
      ]);
    } catch (error) {
      console.error('Error logging download:', error);
    }
  }
}

module.exports = new UpdateController();