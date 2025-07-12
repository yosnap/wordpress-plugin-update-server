# ⚡ Guía de Inicio Rápido

## 🎯 En 5 Minutos

### 1. Instalación (2 min)

```bash
# Clonar y configurar
git clone <tu-repo>
cd servidor-actualizaciones-wordpress
npm install

# Configurar entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL
```

### 2. Configuración Inicial (2 min)

```bash
# Configurar admin
node scripts/setup-admin.js

# Ejecutar migraciones
npm run migrate

# Iniciar servidor
npm start
```

### 3. Primer Plugin (1 min)

```bash
# Registrar plugin
node scripts/register-plugin.js
```

## 🚀 Primeros Pasos Detallados

### Paso 1: Preparar Base de Datos

```sql
-- Crear base de datos PostgreSQL
CREATE DATABASE wordpress_updates;
CREATE USER wp_updates WITH PASSWORD 'tu_password';
GRANT ALL PRIVILEGES ON DATABASE wordpress_updates TO wp_updates;
```

### Paso 2: Configurar .env

```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wordpress_updates
DB_USER=wp_updates
DB_PASSWORD=tu_password

# Servidor
PORT=3000
SERVER_URL=http://localhost:3000

# Seguridad (generar con setup-admin.js)
JWT_SECRET=clave_secreta_muy_larga
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$2b$12$hash_generado...

# GitHub
GITHUB_TOKEN=ghp_tu_token
GITHUB_WEBHOOK_SECRET=secreto_webhook
```

### Paso 3: Verificar Instalación

```bash
# Health check
curl http://localhost:3000/health

# Obtener token admin
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "tu_password"}'
```

## 🔧 Configurar Tu Primer Plugin

### 1. Registrar Plugin en el Servidor

```bash
node scripts/register-plugin.js
```

Información requerida:
- **Slug**: `mi-plugin` (identificador único)
- **Nombre**: `Mi Plugin Increíble`
- **GitHub owner**: `tu-usuario`
- **GitHub repo**: `mi-plugin`

### 2. Configurar Webhook en GitHub

1. Ve a tu repositorio en GitHub
2. Settings → Webhooks → Add webhook
3. Configurar:
   - **Payload URL**: `http://tu-servidor.com/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Tu `GITHUB_WEBHOOK_SECRET`
   - **Events**: `Releases`

### 3. Modificar Tu Plugin de WordPress

```php
<?php
/**
 * Plugin Name: Mi Plugin Increíble
 * Version: 1.0.0
 */

// Copiar class-plugin-updater.php a tu plugin
require_once plugin_dir_path(__FILE__) . 'includes/class-plugin-updater.php';

// Inicializar updater
function mi_plugin_init_updater() {
    new WP_Plugin_Updater(
        __FILE__,                          // Archivo del plugin
        '1.0.0',                           // Versión actual
        'http://tu-servidor.com',          // URL del servidor
        ''                                 // API key (opcional)
    );
}
add_action('init', 'mi_plugin_init_updater');
```

### 4. Probar Actualización

```bash
# 1. Crear nueva versión
git tag v1.0.1
git push origin v1.0.1

# 2. Crear release en GitHub (manual o automático)

# 3. Verificar que el servidor procesó el release
curl http://tu-servidor.com/api/plugins/mi-plugin

# 4. Simular verificación desde WordPress
curl "http://tu-servidor.com/api/updates/check/mi-plugin?version=1.0.0"
```

## 🎉 ¡Listo!

Tu servidor está configurado y funcionando. Los próximos plugins solo requieren:

1. **Registrar** con `node scripts/register-plugin.js`
2. **Configurar webhook** en GitHub
3. **Agregar updater** al plugin de WordPress

## 🔍 Verificación Final

```bash
# Test completo del servidor
node scripts/test-server.js http://localhost:3000

# Monitor en tiempo real
node scripts/monitor-server.js http://localhost:3000
```

## 📋 Checklist de Configuración

- [ ] PostgreSQL instalado y ejecutándose
- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas
- [ ] Servidor iniciado y respondiendo
- [ ] Token de admin funcionando
- [ ] Primer plugin registrado
- [ ] Webhook de GitHub configurado
- [ ] Plugin de WordPress modificado
- [ ] Test de actualización exitoso

## 🆘 Problemas Comunes

| Problema | Solución |
|----------|----------|
| Error de conexión a BD | Verificar credenciales en `.env` |
| Webhook no funciona | Verificar `GITHUB_WEBHOOK_SECRET` |
| Token admin inválido | Regenerar con `setup-admin.js` |
| Plugin no actualiza | Verificar logs en `logs/app.log` |

## 📚 Siguiente Paso

Una vez funcionando, revisa:
- 📖 [README.md](../README.md) - Documentación completa
- 🔐 [security/security-guide.md](../security/security-guide.md) - Configuración de seguridad
- 🔧 [plugin-updater-client/README.md](../plugin-updater-client/README.md) - Integración avanzada