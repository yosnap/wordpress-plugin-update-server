# 📡 API Reference

Documentación completa de todos los endpoints del servidor de actualizaciones WordPress.

## 🔗 Base URL

```
https://tu-servidor.com
```

## 🔐 Autenticación

### Admin JWT Token
```bash
# Obtener token
POST /api/auth/admin/login
{
  "username": "admin",
  "password": "tu_password"
}

# Usar en headers
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Key (WordPress)
```bash
# Usar en headers
Authorization: Bearer wpup_a1b2c3d4e5f6...
```

---

## 📦 Plugins

### Listar Plugins
```http
GET /api/plugins
```

**Respuesta:**
```json
[
  {
    "id": 1,
    "slug": "mi-plugin",
    "name": "Mi Plugin Increíble",
    "author": "Paulo",
    "github_repo": "mi-plugin",
    "github_owner": "tu-usuario",
    "latest_version": "1.2.3",
    "total_downloads": 150,
    "active": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### Obtener Plugin Específico
```http
GET /api/plugins/:slug
```

**Parámetros:**
- `slug` (string): Identificador único del plugin

**Respuesta:**
```json
{
  "id": 1,
  "slug": "mi-plugin",
  "name": "Mi Plugin Increíble",
  "description": "Un plugin que hace cosas increíbles",
  "author": "Paulo",
  "github_repo": "mi-plugin",
  "github_owner": "tu-usuario",
  "homepage": "https://mi-sitio.com",
  "requires_wp": "5.0",
  "tested_wp": "6.3",
  "requires_php": "7.4",
  "versions": [
    {
      "version": "1.2.3",
      "created_at": "2024-01-01T00:00:00.000Z",
      "changelog": "Bug fixes and improvements",
      "download_count": 50
    }
  ]
}
```

### Crear Nuevo Plugin
```http
POST /api/plugins
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**
```json
{
  "slug": "mi-nuevo-plugin",
  "name": "Mi Nuevo Plugin",
  "description": "Descripción del plugin",
  "author": "Tu Nombre",
  "github_repo": "mi-nuevo-plugin",
  "github_owner": "tu-usuario",
  "homepage": "https://tu-sitio.com",
  "requires_wp": "5.0",
  "tested_wp": "6.3",
  "requires_php": "7.4"
}
```

**Respuesta:**
```json
{
  "id": 2,
  "slug": "mi-nuevo-plugin",
  "name": "Mi Nuevo Plugin",
  "created_at": "2024-01-01T00:00:00.000Z",
  "message": "Plugin creado exitosamente"
}
```

### Actualizar Plugin
```http
PUT /api/plugins/:slug
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**
```json
{
  "description": "Nueva descripción",
  "homepage": "https://nuevo-sitio.com",
  "tested_wp": "6.4"
}
```

### Estadísticas del Plugin
```http
GET /api/plugins/:slug/stats
```

**Respuesta:**
```json
{
  "name": "Mi Plugin",
  "slug": "mi-plugin",
  "total_versions": 5,
  "total_downloads": 250,
  "unique_downloads": 180,
  "active_days": 45,
  "last_download": "2024-01-01T00:00:00.000Z",
  "version_stats": [
    {
      "version": "1.2.3",
      "downloads": 50
    }
  ]
}
```

### Desactivar Plugin
```http
DELETE /api/plugins/:slug
Authorization: Bearer <admin_token>
```

---

## 🔄 Actualizaciones (WordPress API)

### Verificar Actualización
```http
GET /api/updates/check/:slug?version=1.0.0
```

**Parámetros:**
- `slug` (string): Identificador del plugin
- `version` (query string): Versión actual instalada

**Headers opcionales:**
- `Authorization: Bearer <api_key>`
- `X-WP-Version: 6.3`
- `X-PHP-Version: 8.1`
- `X-Site-URL: https://mi-sitio.com`

**Respuesta (actualización disponible):**
```json
{
  "slug": "mi-plugin",
  "plugin": "mi-plugin/mi-plugin.php",
  "new_version": "1.2.3",
  "url": "https://mi-sitio.com/plugins/mi-plugin",
  "package": "https://tu-servidor.com/api/updates/download/mi-plugin/1.2.3",
  "icons": {
    "1x": "https://tu-servidor.com/icons/mi-plugin-128x128.png",
    "2x": "https://tu-servidor.com/icons/mi-plugin-256x256.png"
  },
  "requires": "5.0",
  "tested": "6.3",
  "requires_php": "7.4",
  "sections": {
    "description": "Un plugin increíble",
    "changelog": "Bug fixes and improvements"
  },
  "upgrade_notice": "Nueva versión 1.2.3 disponible"
}
```

**Respuesta (actualizado):**
```json
{
  "slug": "mi-plugin",
  "version": "1.2.3",
  "up_to_date": true,
  "message": "Plugin actualizado"
}
```

### Descargar Plugin
```http
GET /api/updates/download/:slug/:version
```

**Parámetros:**
- `slug` (string): Identificador del plugin
- `version` (string): Versión a descargar

**Respuesta:**
- Archivo ZIP del plugin o redirección a GitHub

### Información Completa del Plugin
```http
GET /api/updates/info/:slug
```

**Respuesta:**
```json
{
  "name": "Mi Plugin Increíble",
  "slug": "mi-plugin",
  "version": "1.2.3",
  "author": "Paulo",
  "homepage": "https://mi-sitio.com",
  "requires": "5.0",
  "tested": "6.3",
  "requires_php": "7.4",
  "last_updated": "2024-01-01T00:00:00.000Z",
  "sections": {
    "description": "Un plugin que hace cosas increíbles",
    "changelog": "<h4>Registro de cambios</h4>..."
  },
  "download_link": "https://tu-servidor.com/api/updates/download/mi-plugin/1.2.3"
}
```

### Verificación Múltiple
```http
POST /api/updates/check-multiple
Content-Type: application/json
```

**Body:**
```json
{
  "plugins": [
    {
      "slug": "plugin-1",
      "version": "1.0.0"
    },
    {
      "slug": "plugin-2", 
      "version": "2.1.0"
    }
  ]
}
```

**Respuesta:**
```json
{
  "plugin-1": {
    "slug": "plugin-1",
    "new_version": "1.1.0",
    "package": "https://tu-servidor.com/api/updates/download/plugin-1/1.1.0"
  },
  "plugin-2": {
    "slug": "plugin-2",
    "up_to_date": true,
    "message": "Plugin actualizado"
  }
}
```

---

## 🎣 Webhooks

### Webhook de GitHub
```http
POST /api/webhooks/github
X-GitHub-Event: release
X-Hub-Signature-256: sha256=...
Content-Type: application/json
```

**Body:** Payload estándar de GitHub Release

**Respuesta:**
```json
{
  "message": "Release procesado exitosamente",
  "plugin": "tu-usuario/mi-plugin",
  "version": "1.2.3"
}
```

### Test Manual de Webhook
```http
POST /api/webhooks/test
Content-Type: application/json
```

**Body:**
```json
{
  "repository": "tu-usuario/mi-plugin",
  "tag_name": "v1.2.3"
}
```

### Estado de Webhooks
```http
GET /api/webhooks/status
```

**Respuesta:**
```json
{
  "webhook_configured": true,
  "github_token_configured": true,
  "server_url": "https://tu-servidor.com",
  "upload_dir": "./uploads"
}
```

---

## 👨‍💼 Administración

### Sincronizar Plugin
```http
POST /api/admin/sync/:pluginId
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "plugin_slug": "mi-plugin",
  "synced_versions": 3,
  "total_releases": 5,
  "errors": []
}
```

### Sincronizar Todos los Plugins
```http
POST /api/admin/sync-all
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "message": "Sincronización completada",
  "results": [
    {
      "plugin_slug": "plugin-1",
      "synced_versions": 2,
      "total_releases": 3
    },
    {
      "plugin_slug": "plugin-2",
      "error": "Repository not found"
    }
  ]
}
```

### Rate Limit de GitHub
```http
GET /api/admin/github/rate-limit
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "rate": {
    "limit": 5000,
    "remaining": 4999,
    "reset": 1609459200,
    "used": 1
  }
}
```

### Información de Repositorio
```http
GET /api/admin/github/:owner/:repo
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "id": 123456789,
  "name": "mi-plugin",
  "full_name": "tu-usuario/mi-plugin",
  "private": false,
  "html_url": "https://github.com/tu-usuario/mi-plugin",
  "description": "Mi plugin increíble",
  "default_branch": "main",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

## 🔐 Autenticación

### Login de Administrador
```http
POST /api/auth/admin/login
Content-Type: application/json
```

**Body:**
```json
{
  "username": "admin",
  "password": "tu_password"
}
```

**Respuesta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "message": "Token generado exitosamente"
}
```

### Generar API Key
```http
POST /api/auth/api-keys
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**
```json
{
  "site_url": "https://mi-sitio-wordpress.com",
  "plugin_id": 1
}
```

**Respuesta:**
```json
{
  "id": 1,
  "site_url": "https://mi-sitio-wordpress.com",
  "api_key": "wpup_a1b2c3d4e5f6789...",
  "plugin_id": 1,
  "created_at": "2024-01-01T00:00:00.000Z",
  "message": "API key generada exitosamente"
}
```

### Listar Sitios Autorizados
```http
GET /api/auth/api-keys
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
[
  {
    "id": 1,
    "site_url": "https://mi-sitio.com",
    "plugin_id": 1,
    "plugin_slug": "mi-plugin",
    "plugin_name": "Mi Plugin",
    "active": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "last_check": "2024-01-01T12:00:00.000Z",
    "has_api_key": true
  }
]
```

### Revocar API Key
```http
DELETE /api/auth/api-keys/:siteId
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "message": "API key revocada exitosamente",
  "site_url": "https://mi-sitio.com"
}
```

### Regenerar API Key
```http
POST /api/auth/api-keys/:siteId/regenerate
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "id": 1,
  "site_url": "https://mi-sitio.com",
  "plugin_id": 1,
  "api_key": "wpup_nueva_clave...",
  "message": "API key regenerada exitosamente"
}
```

### Verificar API Key
```http
POST /api/auth/verify
Authorization: Bearer <api_key>
```

**Respuesta:**
```json
{
  "valid": true,
  "site_url": "https://mi-sitio.com",
  "plugin_id": 1,
  "plugin_slug": "mi-plugin",
  "plugin_name": "Mi Plugin",
  "created_at": "2024-01-01T00:00:00.000Z",
  "last_check": "2024-01-01T12:00:00.000Z",
  "active": true
}
```

### Estadísticas de Autenticación
```http
GET /api/auth/stats
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "total_sites": 10,
  "active_sites": 8,
  "active_last_24h": 5,
  "active_last_7d": 7
}
```

---

## 📊 Monitoreo

### Health Check
```http
GET /api/monitoring/health
```

**Respuesta:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "details": "Database connection successful"
    },
    "github": {
      "status": "healthy",
      "responseTime": 250,
      "details": "Rate limit: 4999/5000"
    },
    "filesystem": {
      "status": "healthy",
      "details": "Filesystem accessible and writable"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Métricas en Tiempo Real
```http
GET /api/monitoring/metrics
```

**Respuesta:**
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "memory": {
    "rss": 67108864,
    "heapUsed": 45088768,
    "heapTotal": 54525952,
    "external": 1089536
  },
  "uptime": 3600,
  "activeConnections": 5,
  "recentActivity": {
    "downloads_1h": 25,
    "downloads_5m": 3
  }
}
```

### Dashboard Completo
```http
GET /api/monitoring/dashboard
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "system": {
    "uptime": 3600,
    "memory": {
      "rss": 64,
      "heapUsed": 43,
      "heapTotal": 52,
      "external": 1
    },
    "nodeVersion": "v18.17.0",
    "platform": "linux"
  },
  "database": {
    "totalPlugins": 5,
    "totalVersions": 25,
    "downloads24h": 150,
    "totalSites": 10,
    "activeSites24h": 8
  },
  "logs": {
    "period": "24 hours",
    "appLogs": 1250,
    "securityLogs": 45,
    "accessLogs": 2300,
    "webhookLogs": 12,
    "errorLogs": 3
  },
  "api": {
    "downloadsLast7Days": [
      {
        "date": "2024-01-01",
        "downloads": 50,
        "unique_ips": 35
      }
    ],
    "topPlugins24h": [
      {
        "slug": "mi-plugin",
        "name": "Mi Plugin",
        "download_count": 25
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Limpiar Logs
```http
POST /api/monitoring/logs/clean?days=30
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "message": "Logs older than 30 days cleaned",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## 🚨 Códigos de Error

| Código | Descripción |
|--------|-------------|
| 200 | Éxito |
| 201 | Creado exitosamente |
| 400 | Petición inválida |
| 401 | No autorizado |
| 403 | Prohibido |
| 404 | No encontrado |
| 409 | Conflicto (recurso ya existe) |
| 429 | Demasiadas peticiones |
| 500 | Error interno del servidor |
| 503 | Servicio no disponible |

## 📝 Notas de Implementación

### Rate Limiting
- **Endpoints públicos**: 200 req/15min por IP
- **Login admin**: 5 intentos/min por IP
- **Endpoints admin**: 10 req/min por IP

### Headers Recomendados
```http
Accept: application/json
Content-Type: application/json
User-Agent: WordPress/6.3; https://mi-sitio.com
```

### Formato de Fechas
Todas las fechas están en formato ISO 8601 UTC:
```
2024-01-01T12:00:00.000Z
```