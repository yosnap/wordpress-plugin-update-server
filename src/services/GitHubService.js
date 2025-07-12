const axios = require('axios');
const db = require('../config/database');

class GitHubService {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.headers = {
      'User-Agent': 'WordPress-Plugin-Update-Server/1.0',
      'Accept': 'application/vnd.github.v3+json'
    };

    if (process.env.GITHUB_TOKEN) {
      this.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
  }

  // Obtener información del repositorio
  async getRepository(owner, repo) {
    try {
      const response = await axios.get(`${this.baseURL}/repos/${owner}/${repo}`, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo repositorio ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  // Obtener releases del repositorio
  async getReleases(owner, repo, page = 1, per_page = 10) {
    try {
      const response = await axios.get(`${this.baseURL}/repos/${owner}/${repo}/releases`, {
        headers: this.headers,
        params: { page, per_page }
      });
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo releases de ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  // Obtener release específico por tag
  async getReleaseByTag(owner, repo, tag) {
    try {
      const response = await axios.get(`${this.baseURL}/repos/${owner}/${repo}/releases/tags/${tag}`, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo release ${tag} de ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  // Obtener último release
  async getLatestRelease(owner, repo) {
    try {
      const response = await axios.get(`${this.baseURL}/repos/${owner}/${repo}/releases/latest`, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo último release de ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  // Sincronizar releases de un plugin desde GitHub
  async syncPluginReleases(pluginId) {
    try {
      // Obtener información del plugin
      const pluginQuery = 'SELECT * FROM plugins WHERE id = $1 AND active = true';
      const pluginResult = await db.query(pluginQuery, [pluginId]);
      
      if (pluginResult.rows.length === 0) {
        throw new Error('Plugin no encontrado');
      }

      const plugin = pluginResult.rows[0];
      const { github_owner, github_repo } = plugin;

      console.log(`🔄 Sincronizando releases de ${github_owner}/${github_repo}`);

      // Obtener releases de GitHub
      const releases = await this.getReleases(github_owner, github_repo, 1, 50);
      
      let syncCount = 0;
      const errors = [];

      for (const release of releases) {
        try {
          const version = this.cleanVersion(release.tag_name);
          
          // Verificar si ya existe la versión
          const existingQuery = `
            SELECT id FROM plugin_versions 
            WHERE plugin_id = $1 AND version = $2
          `;
          const existing = await db.query(existingQuery, [pluginId, version]);
          
          if (existing.rows.length > 0) {
            continue; // Ya existe, saltar
          }

          // Buscar asset ZIP
          const zipAsset = release.assets.find(asset => 
            asset.name.endsWith('.zip') || 
            asset.content_type === 'application/zip'
          );

          const downloadUrl = zipAsset ? zipAsset.browser_download_url : release.zipball_url;
          const fileSize = zipAsset ? zipAsset.size : 0;

          // Insertar nueva versión
          const insertQuery = `
            INSERT INTO plugin_versions (
              plugin_id, version, download_url, file_size, 
              changelog, release_notes, github_tag, github_release_id, is_prerelease
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `;

          await db.query(insertQuery, [
            pluginId,
            version,
            downloadUrl,
            fileSize,
            this.extractChangelog(release.body),
            release.body,
            release.tag_name,
            release.id,
            release.prerelease
          ]);

          syncCount++;
          console.log(`✅ Sincronizada versión ${version}`);

        } catch (error) {
          console.error(`❌ Error sincronizando release ${release.tag_name}:`, error.message);
          errors.push({
            release: release.tag_name,
            error: error.message
          });
        }
      }

      // Actualizar timestamp del plugin
      await db.query(
        'UPDATE plugins SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [pluginId]
      );

      return {
        plugin_slug: plugin.slug,
        synced_versions: syncCount,
        total_releases: releases.length,
        errors
      };

    } catch (error) {
      console.error('Error sincronizando plugin:', error);
      throw error;
    }
  }

  // Sincronizar todos los plugins activos
  async syncAllPlugins() {
    try {
      const pluginsQuery = 'SELECT id, slug FROM plugins WHERE active = true';
      const plugins = await db.query(pluginsQuery);
      
      const results = [];
      
      for (const plugin of plugins.rows) {
        try {
          const result = await this.syncPluginReleases(plugin.id);
          results.push(result);
        } catch (error) {
          results.push({
            plugin_slug: plugin.slug,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error sincronizando todos los plugins:', error);
      throw error;
    }
  }

  // Limpiar nombre de versión
  cleanVersion(tagName) {
    return tagName.replace(/^v/, '');
  }

  // Extraer changelog
  extractChangelog(releaseBody) {
    if (!releaseBody) return '';
    
    const changelogMatch = releaseBody.match(/(?:changelog|changes?|what'?s new)[\s:]*(.+)/is);
    if (changelogMatch) {
      return changelogMatch[1].trim();
    }
    
    return releaseBody.substring(0, 1000);
  }

  // Verificar rate limit de GitHub API
  async checkRateLimit() {
    try {
      const response = await axios.get(`${this.baseURL}/rate_limit`, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error('Error verificando rate limit:', error.message);
      throw error;
    }
  }
}

module.exports = new GitHubService();