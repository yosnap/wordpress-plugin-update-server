# 🔐 Guía de Seguridad del Servidor de Actualizaciones

## 🎯 Resumen de Seguridad Implementada

### 🔑 Autenticación de Dos Niveles

**1. Autenticación de Administrador (JWT)**
- Login con username/password
- Tokens JWT con expiración de 24h
- Acceso a endpoints administrativos

**2. API Keys para Sitios WordPress**
- Keys únicas por sitio/plugin
- Autenticación opcional en endpoints públicos
- Tracking de uso y actividad

### 🛡️ Protecciones Implementadas

#### Rate Limiting
- **Endpoints públicos**: 200 req/15min por IP
- **Login admin**: 5 intentos/minuto
- **Endpoints admin**: 10 req/minuto

#### Middleware de Seguridad
- **Helmet.js**: Headers de seguridad HTTP
- **CORS**: Control de acceso entre dominios
- **Input validation**: Validación de parámetros
- **Error handling**: No exposición de errores internos

#### Webhook Security
- **GitHub signature**: Verificación HMAC-SHA256
- **IP whitelisting**: Solo IPs de GitHub (opcional)
- **Payload validation**: Verificación de estructura

## 🚀 Configuración Inicial

### 1. Configurar Credenciales de Admin

```bash
# Generar hash de password
node scripts/setup-admin.js

# O generar hash rápido
node scripts/setup-admin.js hash mi_password_seguro
```

### 2. Variables de Entorno Críticas

```env
# JWT para tokens de admin
JWT_SECRET=tu_clave_secreta_muy_larga_y_aleatoria

# Credenciales de administrador
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$2b$12$hash_generado_por_script

# Webhook de GitHub
GITHUB_WEBHOOK_SECRET=tu_webhook_secret_de_github

# GitHub API (para descargas privadas)
GITHUB_TOKEN=ghp_tu_personal_access_token
```

### 3. Configuración de Base de Datos

```sql
-- Asegurar que la tabla de sitios autorizados existe
SELECT * FROM authorized_sites LIMIT 1;

-- Verificar índices de seguridad
\d authorized_sites
```

## 🔧 Uso del Sistema de Autenticación

### Autenticación de Administrador

```bash
# 1. Obtener token de admin
curl -X POST https://tu-servidor.com/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "tu_password"}'

# Respuesta:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expiresIn": "24h"
# }

# 2. Usar token en requests administrativos
curl -X GET https://tu-servidor.com/api/admin/sync-all \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Gestión de API Keys

```bash
# Generar API key para un sitio
curl -X POST https://tu-servidor.com/api/auth/api-keys \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://mi-sitio-wordpress.com",
    "plugin_id": 1
  }'

# Respuesta:
# {
#   "api_key": "wpup_a1b2c3d4e5f6...",
#   "site_url": "https://mi-sitio-wordpress.com",
#   "plugin_id": 1
# }

# Listar sitios autorizados
curl -X GET https://tu-servidor.com/api/auth/api-keys \
  -H "Authorization: Bearer <admin_token>"

# Revocar API key
curl -X DELETE https://tu-servidor.com/api/auth/api-keys/123 \
  -H "Authorization: Bearer <admin_token>"
```

### Uso de API Keys en WordPress

```php
// En tu plugin de WordPress
new WP_Plugin_Updater(
    __FILE__,
    '1.0.0',
    'https://tu-servidor.com',
    'wpup_a1b2c3d4e5f6...' // API key generada
);
```

## 🔒 Mejores Prácticas de Seguridad

### 1. Configuración del Servidor

```javascript
// Ejemplo de configuración de producción
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 2. Configuración de Proxy Reverso (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name tu-servidor.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Headers de seguridad
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting adicional
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rate limiting más estricto para admin
    location /api/admin {
        limit_req zone=api burst=5 nodelay;
        proxy_pass http://localhost:3000;
    }
}
```

### 3. Configuración de Firewall

```bash
# UFW (Ubuntu)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 3000/tcp   # Bloquear acceso directo a Node.js
ufw enable

# Fail2ban para protección adicional
apt install fail2ban
```

## 🚨 Monitoreo de Seguridad

### 1. Logs de Seguridad

```javascript
// Configurar logging de eventos de seguridad
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' })
  ]
});

// Registrar eventos importantes
securityLogger.info('Admin login attempt', {
  username,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  success: true
});
```

### 2. Alertas Automáticas

```bash
# Script para monitorear intentos de login fallidos
grep "Admin login attempt" logs/security.log | grep "success: false" | tail -10

# Alerta por email en caso de múltiples fallos
if [ $(grep "success: false" logs/security.log | wc -l) -gt 10 ]; then
    echo "Multiple failed login attempts detected" | mail -s "Security Alert" admin@tu-dominio.com
fi
```

## 🔍 Auditoría y Compliance

### 1. Endpoints de Auditoría

```bash
# Estadísticas de autenticación
curl -X GET https://tu-servidor.com/api/auth/stats \
  -H "Authorization: Bearer <admin_token>"

# Actividad de sitios autorizados
curl -X GET https://tu-servidor.com/api/auth/api-keys \
  -H "Authorization: Bearer <admin_token>"
```

### 2. Rotación de Credenciales

```bash
# Regenerar API key específica
curl -X POST https://tu-servidor.com/api/auth/api-keys/123/regenerate \
  -H "Authorization: Bearer <admin_token>"

# Regenerar JWT secret (requiere reinicio)
openssl rand -base64 64 > .jwt_secret
```

## 🆘 Respuesta a Incidentes

### 1. Compromiso de API Key

```bash
# Revocar inmediatamente
curl -X DELETE https://tu-servidor.com/api/auth/api-keys/<site_id> \
  -H "Authorization: Bearer <admin_token>"

# Verificar logs de uso
grep "API key: wpup_compromised" logs/access.log
```

### 2. Compromiso de Credenciales Admin

```bash
# 1. Cambiar password inmediatamente
node scripts/setup-admin.js hash nueva_password_segura

# 2. Cambiar JWT_SECRET
openssl rand -base64 64

# 3. Reiniciar servidor para invalidar tokens existentes
pm2 restart servidor-updates

# 4. Auditar logs de acceso administrativo
grep "admin" logs/security.log | grep "$(date +%Y-%m-%d)"
```

## 📊 Checklist de Seguridad

### ✅ Configuración Inicial
- [ ] JWT_SECRET configurado (64+ caracteres aleatorios)
- [ ] ADMIN_PASSWORD hasheado con bcrypt
- [ ] GITHUB_WEBHOOK_SECRET configurado
- [ ] Base de datos con SSL habilitado
- [ ] Certificado SSL/TLS válido

### ✅ Configuración de Producción
- [ ] NODE_ENV=production
- [ ] Proxy reverso (Nginx/Apache) configurado
- [ ] Rate limiting habilitado
- [ ] Logs de seguridad configurados
- [ ] Backup automático de base de datos
- [ ] Monitoreo de uptime configurado

### ✅ Mantenimiento Regular
- [ ] Rotación de API keys cada 6 meses
- [ ] Actualización de dependencias npm
- [ ] Revisión de logs de seguridad
- [ ] Testing de endpoints de seguridad
- [ ] Backup y test de restauración

## 🔗 Referencias Adicionales

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)