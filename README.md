# 🚀 Servidor de Actualizaciones WordPress

Sistema completo para automatizar las actualizaciones de plugins de WordPress desde GitHub, eliminando la necesidad de actualizar manualmente cada sitio.

## 📋 Descripción

Este servidor actúa como intermediario entre tus repositorios de GitHub y las instalaciones de WordPress, proporcionando actualizaciones automáticas cuando publicas nuevas versiones de tus plugins.

### ✨ Características Principales

- 🔄 **Actualizaciones automáticas** desde GitHub releases
- 📦 **Compatible con WordPress Update API**
- 🔐 **Autenticación y seguridad robusta**
- 📊 **Monitoreo y logging completo**
- 🌐 **Multi-plugin y multi-sitio**
- 📈 **Estadísticas de uso detalladas**
- 🛡️ **Rate limiting y protección contra ataques**

## 🏗️ Arquitectura

```
GitHub Release → Webhook → Tu Servidor → WordPress
     ↓              ↓           ↓           ↓
  git push      Procesa     Almacena    Notifica
  con tag       nueva       nueva       actualización
               versión     versión     disponible
```

## 🚀 Instalación Rápida

### 1. Clonar y configurar

```bash
git clone <tu-repo>
cd servidor-actualizaciones-wordpress
npm install
```

### 2. Configurar base de datos PostgreSQL

```bash
# Crear base de datos
createdb wordpress_updates

# Copiar configuración
cp .env.example .env
```

### 3. Configurar variables de entorno

```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wordpress_updates
DB_USER=tu_usuario
DB_PASSWORD=tu_password

# Servidor
PORT=3000
NODE_ENV=production
SERVER_URL=https://tu-dominio.com

# Seguridad
JWT_SECRET=tu_clave_secreta_muy_larga_y_aleatoria
ADMIN_USERNAME=admin
ADMIN_PASSWORD=tu_password_hasheado

# GitHub
GITHUB_TOKEN=ghp_tu_personal_access_token
GITHUB_WEBHOOK_SECRET=tu_webhook_secret
```

### 4. Configurar credenciales de admin

```bash
node scripts/setup-admin.js
```

### 5. Ejecutar migraciones e iniciar

```bash
npm run migrate
npm start
```

## 📚 Guía de Uso Completa

### 🔧 Configuración Inicial

#### 1. Registrar un plugin

```bash
# Método 1: Script interactivo
node scripts/register-plugin.js

# Método 2: API directa
curl -X POST https://tu-servidor.com/api/plugins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "slug": "mi-plugin",
    "name": "Mi Plugin Increíble",
    "description": "Un plugin que hace cosas increíbles",
    "author": "Tu Nombre",
    "github_repo": "mi-plugin",
    "github_owner": "tu-usuario",
    "homepage": "https://tu-sitio.com",
    "requires_wp": "5.0",
    "tested_wp": "6.3",
    "requires_php": "7.4"
  }'
```

#### 2. Configurar webhook en GitHub

1. Ve a tu repositorio → Settings → Webhooks
2. Add webhook:
   - **URL**: `https://tu-servidor.com/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Tu `GITHUB_WEBHOOK_SECRET`
   - **Events**: `Releases`

#### 3. Integrar en tu plugin de WordPress

```bash
# Copiar el cliente PHP a tu plugin
cp plugin-updater-client/class-plugin-updater.php tu-plugin/includes/
```

```php
// En tu archivo principal del plugin
require_once plugin_dir_path(__FILE__) . 'includes/class-plugin-updater.php';

function mi_plugin_init_updater() {
    new WP_Plugin_Updater(
        __FILE__,                    // Archivo del plugin
        '1.0.0',                     // Versión actual
        'https://tu-servidor.com',   // URL del servidor
        'wpup_api_key_opcional'      // API key (opcional)
    );
}
add_action('init', 'mi_plugin_init_updater');
```

### 🔄 Flujo de Actualización

1. **Desarrollas** nueva versión de tu plugin
2. **Haces git push** con tag: `git tag v1.1.0 && git push origin v1.1.0`
3. **Creas release** en GitHub (manual o automático)
4. **GitHub envía webhook** a tu servidor
5. **Servidor procesa** y almacena nueva versión
6. **WordPress verifica** actualizaciones automáticamente
7. **Usuario ve notificación** de actualización disponible
8. **Usuario actualiza** con un clic

## 🔐 Gestión de Seguridad

### Autenticación de Administrador

```bash
# Obtener token JWT
curl -X POST https://tu-servidor.com/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "tu_password"}'

# Usar token en requests administrativos
curl -X GET https://tu-servidor.com/api/admin/sync-all \
  -H "Authorization: Bearer <jwt_token>"
```

### API Keys para Sitios

```bash
# Generar API key para un sitio específico
curl -X POST https://tu-servidor.com/api/auth/api-keys \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://mi-sitio-wordpress.com",
    "plugin_id": 1
  }'

# Listar sitios autorizados
curl -X GET https://tu-servidor.com/api/auth/api-keys \
  -H "Authorization: Bearer <admin_token>"
```

## 📊 Monitoreo y Estadísticas

### Health Check

```bash
# Verificación básica de salud
curl https://tu-servidor.com/api/monitoring/health

# Métricas en tiempo real
curl https://tu-servidor.com/api/monitoring/metrics

# Dashboard completo (requiere admin)
curl -H "Authorization: Bearer <token>" \
     https://tu-servidor.com/api/monitoring/dashboard
```

### Monitor Continuo

```bash
# Monitor básico
node scripts/monitor-server.js https://tu-servidor.com

# Con alertas automáticas
ALERT_WEBHOOK_URL=https://hooks.slack.com/... \
ADMIN_TOKEN=<jwt_token> \
node scripts/monitor-server.js
```

## 🛠️ Herramientas Incluidas

### Scripts de Utilidad

| Script | Descripción |
|--------|-------------|
| `setup-admin.js` | Configurar credenciales de administrador |
| `register-plugin.js` | Registrar nuevo plugin interactivamente |
| `test-server.js` | Suite de pruebas del servidor |
| `monitor-server.js` | Monitor continuo con alertas |

### Arquitectura de Archivos

```
├── src/
│   ├── app.js                 # Aplicación principal
│   ├── config/
│   │   └── database.js        # Configuración PostgreSQL
│   ├── controllers/           # Lógica de negocio
│   │   ├── AuthController.js
│   │   ├── PluginController.js
│   │   ├── UpdateController.js
│   │   ├── WebhookController.js
│   │   └── MonitoringController.js
│   ├── middleware/            # Middleware personalizado
│   │   ├── auth.js
│   │   └── logging.js
│   ├── routes/                # Definición de rutas
│   ├── services/              # Servicios externos
│   │   ├── GitHubService.js
│   │   └── LoggerService.js
│   └── database/
│       ├── schema.sql         # Esquema de base de datos
│       └── migrate.js         # Script de migraciones
├── plugin-updater-client/     # Cliente PHP para WordPress
├── scripts/                   # Scripts de utilidad
├── security/                  # Documentación de seguridad
└── logs/                      # Archivos de log
```

## 📡 API Reference

### Endpoints Principales

#### Plugins
- `GET /api/plugins` - Listar plugins
- `POST /api/plugins` - Crear plugin
- `GET /api/plugins/:slug` - Obtener plugin
- `PUT /api/plugins/:slug` - Actualizar plugin
- `GET /api/plugins/:slug/stats` - Estadísticas

#### Actualizaciones (WordPress)
- `GET /api/updates/check/:slug?version=1.0.0` - Verificar actualización
- `GET /api/updates/download/:slug/:version` - Descargar plugin
- `GET /api/updates/info/:slug` - Información del plugin

#### Administración
- `POST /api/admin/sync/:pluginId` - Sincronizar plugin
- `POST /api/admin/sync-all` - Sincronizar todos
- `GET /api/admin/github/rate-limit` - Verificar rate limit

#### Autenticación
- `POST /api/auth/admin/login` - Login administrador
- `POST /api/auth/api-keys` - Generar API key
- `GET /api/auth/api-keys` - Listar sitios autorizados

#### Monitoreo
- `GET /api/monitoring/health` - Health check
- `GET /api/monitoring/metrics` - Métricas tiempo real
- `GET /api/monitoring/dashboard` - Dashboard completo

#### Webhooks
- `POST /api/webhooks/github` - Webhook de GitHub
- `POST /api/webhooks/test` - Test manual

## 🚨 Troubleshooting

### Problemas Comunes

#### Plugin no se actualiza en WordPress

1. **Verificar registro del plugin**:
   ```bash
   curl https://tu-servidor.com/api/plugins/mi-plugin
   ```

2. **Verificar webhook de GitHub**:
   ```bash
   curl https://tu-servidor.com/api/webhooks/status
   ```

3. **Verificar logs**:
   ```bash
   tail -f logs/webhooks.log
   tail -f logs/app.log
   ```

#### Error de conexión a base de datos

1. **Verificar credenciales** en `.env`
2. **Verificar que PostgreSQL** esté ejecutándose
3. **Ejecutar migraciones**: `npm run migrate`

#### Webhook no funciona

1. **Verificar GITHUB_WEBHOOK_SECRET** en `.env`
2. **Verificar configuración** en GitHub
3. **Verificar logs**: `tail -f logs/webhooks.log`

#### Problemas de autenticación

1. **Regenerar token admin**:
   ```bash
   curl -X POST https://tu-servidor.com/api/auth/admin/login \
     -d '{"username":"admin","password":"tu_password"}'
   ```

2. **Verificar API key**:
   ```bash
   curl -X POST https://tu-servidor.com/api/auth/verify \
     -H "Authorization: Bearer wpup_tu_api_key"
   ```

### Logs Importantes

| Archivo | Contenido |
|---------|-----------|
| `logs/app.log` | Logs generales de la aplicación |
| `logs/security.log` | Eventos de autenticación y seguridad |
| `logs/access.log` | Todas las requests HTTP |
| `logs/webhooks.log` | Eventos de webhooks de GitHub |
| `logs/error.log` | Errores y excepciones |

## 🎯 Configuración de Producción

### 1. Variables de Entorno de Producción

```env
NODE_ENV=production
LOG_LEVEL=warn
PORT=3000

# Base de datos con SSL
DB_HOST=tu-db-host.com
DB_SSL=true

# URLs de producción
SERVER_URL=https://updates.tu-dominio.com

# Alertas
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
```

### 2. Configuración de Proxy Reverso (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name updates.tu-dominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Process Manager (PM2)

```bash
# Instalar PM2
npm install -g pm2

# Configurar aplicación
pm2 start src/app.js --name "wp-updates-server"

# Configurar startup
pm2 startup
pm2 save
```

### 4. Backup de Base de Datos

```bash
# Script de backup diario
#!/bin/bash
pg_dump wordpress_updates > backup_$(date +%Y%m%d).sql
aws s3 cp backup_$(date +%Y%m%d).sql s3://tu-bucket/backups/
```

## 🤝 Contribución

### Estructura para Desarrollo

```bash
# Clonar repositorio
git clone <tu-repo>
cd servidor-actualizaciones-wordpress

# Instalar dependencias
npm install

# Configurar entorno de desarrollo
cp .env.example .env.dev
# Editar .env.dev con configuración local

# Ejecutar en modo desarrollo
NODE_ENV=development npm run dev

# Ejecutar tests
npm test
```

### Tests Disponibles

```bash
# Test completo del servidor
node scripts/test-server.js http://localhost:3000

# Test de endpoints específicos
curl http://localhost:3000/health
curl http://localhost:3000/api/plugins
```

## 📞 Soporte

### Recursos de Ayuda

- 📖 **Documentación completa**: Ver carpetas `security/` y `plugin-updater-client/`
- 🔍 **Logs detallados**: Revisar archivos en `logs/`
- 🧪 **Suite de pruebas**: `node scripts/test-server.js`
- 📊 **Monitoreo**: `https://tu-servidor.com/api/monitoring/health`

### Contacto

Para soporte y preguntas:
- Revisar logs: `tail -f logs/app.log`
- Verificar health: `curl https://tu-servidor.com/api/monitoring/health`
- GitHub Issues: <tu-repo>/issues

---

## 📄 Licencia

MIT License - Ver archivo LICENSE para detalles.

---

**🎉 ¡Tu servidor de actualizaciones WordPress está listo para automatizar todas tus actualizaciones de plugins!**