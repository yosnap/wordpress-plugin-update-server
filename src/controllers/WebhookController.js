const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const logger = require('../services/LoggerService');

class WebhookController {
  
  // Verificar firma del webhook de GitHub
  verifyGitHubSignature(payload, signature) {
    if (!process.env.GITHUB_WEBHOOK_SECRET) {
      console.warn('⚠️  GITHUB_WEBHOOK_SECRET no configurado - saltando verificación');
      return true;
    }
    
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature), 
      Buffer.from(digest)
    );
  }

  // Manejar webhook de GitHub
  async handleGitHubWebhook(req, res) {
    try {
      const signature = req.get('X-Hub-Signature-256');
      const event = req.get('X-GitHub-Event');
      const payload = JSON.stringify(req.body);

      // Verificar firma de seguridad
      if (signature && !this.verifyGitHubSignature(payload, signature)) {
        console.error('❌ Firma de webhook inválida');
        return res.status(401).json({ error: 'Firma inválida' });
      }

      console.log(`📥 Webhook recibido: ${event}`);

      // Solo procesar eventos de release
      if (event !== 'release') {
        console.log(`ℹ️  Evento ${event} ignorado - solo procesamos releases`);
        return res.json({ message: `Evento ${event} ignorado` });
      }

      const { action, release, repository } = req.body;

      // Solo procesar releases publicados (no borradores)
      if (action !== 'published') {
        console.log(`ℹ️  Acción ${action} ignorada - solo procesamos 'published'`);
        return res.json({ message: `Acción ${action} ignorada` });
      }

      await this.processNewRelease(release, repository);
      
      res.json({ 
        message: 'Release procesado exitosamente',
        plugin: `${repository.owner.login}/${repository.name}`,
        version: release.tag_name
      });

    } catch (error) {
      console.error('❌ Error procesando webhook:', error);
      res.status(500).json({ error: 'Error procesando webhook' });
    }
  }

  // Procesar nuevo release
  async processNewRelease(release, repository) {
    const repoOwner = repository.owner.login;
    const repoName = repository.name;
    const version = this.cleanVersion(release.tag_name);
    
    console.log(`🚀 Procesando release ${version} de ${repoOwner}/${repoName}`);

    // Buscar plugin en la base de datos
    const pluginQuery = `
      SELECT * FROM plugins 
      WHERE github_owner = $1 AND github_repo = $2 AND active = true
    `;
    
    const pluginResult = await db.query(pluginQuery, [repoOwner, repoName]);
    
    if (pluginResult.rows.length === 0) {
      console.log(`⚠️  Plugin ${repoOwner}/${repoName} no encontrado en BD`);
      return;
    }

    const plugin = pluginResult.rows[0];

    // Verificar si la versión ya existe
    const versionQuery = `
      SELECT id FROM plugin_versions 
      WHERE plugin_id = $1 AND version = $2
    `;
    
    const versionResult = await db.query(versionQuery, [plugin.id, version]);
    
    if (versionResult.rows.length > 0) {
      console.log(`ℹ️  Versión ${version} ya existe para ${plugin.slug}`);
      return;
    }

    // Buscar asset ZIP en el release
    const zipAsset = release.assets.find(asset => 
      asset.name.endsWith('.zip') || 
      asset.content_type === 'application/zip'
    );

    let downloadUrl = null;
    let filePath = null;
    let fileSize = 0;

    if (zipAsset) {
      downloadUrl = zipAsset.browser_download_url;
      fileSize = zipAsset.size;
      
      // Intentar descargar el archivo
      try {
        filePath = await this.downloadReleaseAsset(zipAsset, plugin.slug, version);
      } catch (error) {
        console.error(`❌ Error descargando asset: ${error.message}`);
        // Continuar sin archivo local, usar URL directa
      }
    } else {
      // Si no hay ZIP asset, usar tarball de GitHub
      downloadUrl = release.zipball_url;
    }

    // Guardar nueva versión en BD
    const insertQuery = `
      INSERT INTO plugin_versions (
        plugin_id, version, download_url, file_path, file_size, 
        changelog, release_notes, github_tag, github_release_id, is_prerelease
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const newVersion = await db.query(insertQuery, [
      plugin.id,
      version,
      downloadUrl,
      filePath,
      fileSize,
      this.extractChangelog(release.body),
      release.body,
      release.tag_name,
      release.id,
      release.prerelease
    ]);

    // Log del éxito
    logger.logReleaseProcessed(
      plugin.slug, 
      version, 
      `${repoOwner}/${repoName}`, 
      true
    );
    
    // Actualizar timestamp del plugin
    await db.query(
      'UPDATE plugins SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [plugin.id]
    );

    return newVersion.rows[0];
  }

  // Limpiar etiqueta de versión (remover 'v' prefix)
  cleanVersion(tagName) {
    return tagName.replace(/^v/, '');
  }

  // Extraer changelog del cuerpo del release
  extractChangelog(releaseBody) {
    if (!releaseBody) return '';
    
    // Buscar sección de changelog
    const changelogMatch = releaseBody.match(/(?:changelog|changes?|what'?s new)[\s:]*(.+)/is);
    if (changelogMatch) {
      return changelogMatch[1].trim();
    }
    
    // Si no hay sección específica, devolver todo el cuerpo
    return releaseBody.substring(0, 1000); // Limitar longitud
  }

  // Descargar asset del release
  async downloadReleaseAsset(asset, pluginSlug, version) {
    const fileName = `${pluginSlug}-${version}.zip`;
    const uploadsDir = path.join(__dirname, '../../uploads');
    const filePath = path.join(uploadsDir, fileName);
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    console.log(`📥 Descargando ${asset.name}...`);

    const response = await axios({
      method: 'GET',
      url: asset.browser_download_url,
      responseType: 'stream',
      headers: {
        'Authorization': process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : undefined,
        'User-Agent': 'WordPress-Plugin-Update-Server/1.0'
      },
      timeout: 30000 // 30 segundos
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Archivo descargado: ${fileName}`);
        resolve(fileName); // Retornar nombre relativo para BD
      });
      
      writer.on('error', (error) => {
        console.error(`❌ Error escribiendo archivo: ${error.message}`);
        // Limpiar archivo parcial
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
    });
  }

  // Endpoint para test manual del webhook
  async testWebhook(req, res) {
    try {
      const { repository, tag_name } = req.body;
      
      if (!repository || !tag_name) {
        return res.status(400).json({
          error: 'Se requiere repository y tag_name para el test'
        });
      }

      // Simular payload de GitHub
      const mockRelease = {
        tag_name,
        name: tag_name,
        body: 'Test release generado manualmente',
        prerelease: false,
        id: Date.now(),
        assets: [],
        zipball_url: `https://github.com/${repository}/archive/refs/tags/${tag_name}.zip`
      };

      const mockRepo = {
        name: repository.split('/')[1],
        owner: { login: repository.split('/')[0] }
      };

      await this.processNewRelease(mockRelease, mockRepo);
      
      res.json({
        message: 'Test webhook procesado exitosamente',
        repository,
        version: this.cleanVersion(tag_name)
      });
      
    } catch (error) {
      console.error('Error en test webhook:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new WebhookController();