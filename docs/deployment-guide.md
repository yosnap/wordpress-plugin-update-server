# 🚀 Guía de Deployment

Guía completa para desplegar tu servidor de actualizaciones WordPress en producción.

## 🎯 Opciones de Deployment

### 1. VPS/Servidor Dedicado (Recomendado)
### 2. Docker + Docker Compose
### 3. Servicios Cloud (AWS, DigitalOcean, etc.)
### 4. Serverless (Vercel, Netlify Functions)

---

## 🖥️ VPS/Servidor Dedicado

### Requisitos del Sistema

```bash
# Especificaciones mínimas
- CPU: 1 vCore
- RAM: 1GB
- Almacenamiento: 20GB SSD
- OS: Ubuntu 20.04+ / CentOS 8+
- Node.js: 18+
- PostgreSQL: 13+
```

### 1. Preparar el Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y curl git nginx postgresql postgresql-contrib

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version
npm --version
```

### 2. Configurar PostgreSQL

```bash
# Cambiar a usuario postgres
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE wordpress_updates;
CREATE USER wp_updates WITH PASSWORD 'password_seguro';
GRANT ALL PRIVILEGES ON DATABASE wordpress_updates TO wp_updates;
\q

# Configurar autenticación
sudo nano /etc/postgresql/13/main/pg_hba.conf
# Cambiar 'peer' a 'md5' para conexiones locales

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
sudo systemctl enable postgresql
```

### 3. Configurar la Aplicación

```bash
# Crear usuario para la aplicación
sudo adduser --system --group --home /opt/wp-updates wp-updates

# Cambiar a directorio de la aplicación
sudo -u wp-updates -i
cd /opt/wp-updates

# Clonar repositorio
git clone https://github.com/tu-usuario/servidor-actualizaciones-wordpress.git .

# Instalar dependencias
npm install --production

# Configurar variables de entorno
cp .env.example .env
nano .env
```

### 4. Configurar Variables de Entorno de Producción

```env
# /opt/wp-updates/.env
NODE_ENV=production
PORT=3000

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wordpress_updates
DB_USER=wp_updates
DB_PASSWORD=password_seguro

# Servidor
SERVER_URL=https://updates.tu-dominio.com

# Seguridad
JWT_SECRET=clave_super_secreta_64_caracteres_minimo_para_produccion
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$2b$12$hash_generado_con_setup_admin

# GitHub
GITHUB_TOKEN=ghp_tu_personal_access_token
GITHUB_WEBHOOK_SECRET=webhook_secret_muy_seguro

# Logging
LOG_LEVEL=warn
MONITOR_LOG_FILE=/opt/wp-updates/logs/monitor.log

# Alertas (opcional)
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/tu/webhook/url
```

### 5. Ejecutar Migraciones

```bash
# Como usuario wp-updates
sudo -u wp-updates -i
cd /opt/wp-updates
npm run migrate
```

### 6. Configurar PM2 (Process Manager)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Crear archivo de configuración PM2
sudo -u wp-updates nano /opt/wp-updates/ecosystem.config.js
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'wp-updates-server',
    script: 'src/app.js',
    cwd: '/opt/wp-updates',
    user: 'wp-updates',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/wp-updates/logs/pm2-error.log',
    out_file: '/opt/wp-updates/logs/pm2-out.log',
    log_file: '/opt/wp-updates/logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

```bash
# Iniciar aplicación con PM2
sudo -u wp-updates pm2 start ecosystem.config.js

# Configurar PM2 para arranque automático
sudo pm2 startup systemd -u wp-updates --hp /opt/wp-updates
sudo -u wp-updates pm2 save

# Verificar estado
sudo -u wp-updates pm2 status
sudo -u wp-updates pm2 logs
```

### 7. Configurar Nginx como Proxy Reverso

```bash
# Crear configuración de Nginx
sudo nano /etc/nginx/sites-available/wp-updates
```

```nginx
# /etc/nginx/sites-available/wp-updates
server {
    listen 80;
    server_name updates.tu-dominio.com;
    
    # Redireccionar a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name updates.tu-dominio.com;

    # Certificados SSL (configurar con Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/updates.tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/updates.tu-dominio.com/privkey.pem;
    
    # Configuración SSL moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # Headers de seguridad
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Tamaño máximo de body
    client_max_body_size 50M;
    
    # Logs
    access_log /var/log/nginx/wp-updates-access.log;
    error_log /var/log/nginx/wp-updates-error.log;
    
    # Proxy a Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Rate limiting más estricto para admin
    location /api/admin {
        limit_req zone=api burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Cache para archivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/wp-updates /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install snapd
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Obtener certificado
sudo certbot --nginx -d updates.tu-dominio.com

# Configurar renovación automática
sudo crontab -e
# Agregar línea:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 9. Configurar Firewall

```bash
# Instalar UFW
sudo apt install ufw

# Configurar reglas
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 5432 # PostgreSQL (solo si necesitas acceso externo)

# Habilitar firewall
sudo ufw enable
sudo ufw status
```

### 10. Configurar Backup Automático

```bash
# Crear script de backup
sudo nano /opt/wp-updates/scripts/backup.sh
```

```bash
#!/bin/bash
# /opt/wp-updates/scripts/backup.sh

BACKUP_DIR="/opt/wp-updates/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="wordpress_updates"

# Crear directorio de backup
mkdir -p $BACKUP_DIR

# Backup de base de datos
pg_dump -h localhost -U wp_updates $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Backup de uploads y logs
tar -czf $BACKUP_DIR/files_backup_$DATE.tar.gz /opt/wp-updates/uploads /opt/wp-updates/logs

# Limpiar backups antiguos (mantener últimos 7 días)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completado: $DATE"
```

```bash
# Hacer ejecutable
sudo chmod +x /opt/wp-updates/scripts/backup.sh

# Configurar cron para backup diario
sudo -u wp-updates crontab -e
# Agregar línea:
# 0 2 * * * /opt/wp-updates/scripts/backup.sh
```

---

## 🐳 Docker Deployment

### 1. Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine

# Crear directorio de la aplicación
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Crear directorio para uploads y logs
RUN mkdir -p uploads logs

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Cambiar ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
```

### 2. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: wordpress_updates
      POSTGRES_USER: wp_updates
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

### 3. Configuración de Nginx para Docker

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name updates.tu-dominio.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name updates.tu-dominio.com;

        ssl_certificate /etc/ssl/certs/fullchain.pem;
        ssl_certificate_key /etc/ssl/certs/privkey.pem;

        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 4. Comandos Docker

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Ejecutar migraciones
docker-compose exec app npm run migrate

# Backup de base de datos
docker-compose exec postgres pg_dump -U wp_updates wordpress_updates > backup.sql

# Escalar aplicación
docker-compose up -d --scale app=3
```

---

## ☁️ Cloud Deployment (AWS)

### 1. EC2 + RDS

```bash
# Launch EC2 instance (t3.small recomendado)
# Configure RDS PostgreSQL instance
# Configure ALB (Application Load Balancer)
# Configure ACM (Certificate Manager) for SSL
```

### 2. AWS Infrastructure as Code (Terraform)

```hcl
# main.tf
provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "wp-updates-vpc"
  }
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "wp-updates-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "wp-updates-db-subnet-group"
  }
}

# RDS Instance
resource "aws_db_instance" "postgres" {
  identifier     = "wp-updates-db"
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  
  db_name  = "wordpress_updates"
  username = "wp_updates"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = true
  deletion_protection = false

  tags = {
    Name = "wp-updates-postgres"
  }
}

# EC2 Instance
resource "aws_instance" "app" {
  ami                    = "ami-0c55b159cbfafe1d0" # Ubuntu 20.04
  instance_type          = "t3.small"
  key_name              = var.key_name
  vpc_security_group_ids = [aws_security_group.app.id]
  subnet_id              = aws_subnet.public_a.id
  
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    db_host     = aws_db_instance.postgres.address
    db_password = var.db_password
  }))

  tags = {
    Name = "wp-updates-app"
  }
}
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  release:
    types: [published]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: test_db
          DB_USER: postgres
          DB_PASSWORD: postgres

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.PRIVATE_KEY }}
          script: |
            cd /opt/wp-updates
            git pull origin main
            npm ci --production
            npm run migrate
            pm2 restart wp-updates-server
```

---

## 📊 Monitoreo en Producción

### 1. Configurar Alertas

```bash
# Instalar herramientas de monitoreo
sudo apt install htop iotop nethogs

# Configurar logrotate
sudo nano /etc/logrotate.d/wp-updates
```

```
/opt/wp-updates/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 wp-updates wp-updates
    postrotate
        sudo -u wp-updates pm2 reload wp-updates-server
    endscript
}
```

### 2. Script de Monitoreo Avanzado

```bash
# /opt/wp-updates/scripts/health-check.sh
#!/bin/bash

SERVER_URL="https://updates.tu-dominio.com"
WEBHOOK_URL="$ALERT_WEBHOOK_URL"

# Health check
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $SERVER_URL/api/monitoring/health)

if [ "$HEALTH" != "200" ]; then
    MESSAGE="🚨 Servidor WordPress Updates DOWN - HTTP $HEALTH"
    curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"$MESSAGE\"}" \
         $WEBHOOK_URL
fi

# Verificar uso de memoria
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
if (( $(echo "$MEMORY_USAGE > 90" | bc -l) )); then
    MESSAGE="⚠️ Alta utilización de memoria: ${MEMORY_USAGE}%"
    curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"$MESSAGE\"}" \
         $WEBHOOK_URL
fi

# Verificar espacio en disco
DISK_USAGE=$(df -h / | awk 'NR==2{printf "%s", $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    MESSAGE="⚠️ Poco espacio en disco: ${DISK_USAGE}%"
    curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"$MESSAGE\"}" \
         $WEBHOOK_URL
fi
```

### 3. Configurar Cron para Monitoreo

```bash
sudo -u wp-updates crontab -e
# Agregar líneas:
# */5 * * * * /opt/wp-updates/scripts/health-check.sh
# 0 2 * * * /opt/wp-updates/scripts/backup.sh
# 0 0 * * 0 /opt/wp-updates/scripts/cleanup-logs.sh
```

---

## 🛡️ Seguridad en Producción

### 1. Fail2Ban

```bash
# Instalar Fail2Ban
sudo apt install fail2ban

# Configurar para Nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/wp-updates-error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/wp-updates-error.log
maxretry = 10
```

### 2. Configuración de PostgreSQL Segura

```bash
# Editar configuración
sudo nano /etc/postgresql/13/main/postgresql.conf
```

```
# Conexiones
max_connections = 100
shared_buffers = 256MB

# Logging
log_statement = 'mod'
log_min_duration_statement = 1000

# SSL
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
```

### 3. Rotación de Secretos

```bash
# Script para rotar JWT secret
#!/bin/bash
# /opt/wp-updates/scripts/rotate-jwt.sh

NEW_SECRET=$(openssl rand -base64 64)
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" /opt/wp-updates/.env
sudo -u wp-updates pm2 restart wp-updates-server
echo "JWT Secret rotated at $(date)"
```

---

## 📋 Checklist de Producción

### Pre-Deployment
- [ ] Variables de entorno configuradas
- [ ] Base de datos creada y migrada
- [ ] SSL certificado instalado
- [ ] Firewall configurado
- [ ] Backup automático configurado
- [ ] Monitoreo configurado

### Post-Deployment
- [ ] Health check respondiendo
- [ ] Logs generándose correctamente
- [ ] Webhook de GitHub funcionando
- [ ] Autenticación admin funcionando
- [ ] Rate limiting activo
- [ ] Alertas configuradas

### Mantenimiento Regular
- [ ] Revisar logs semanalmente
- [ ] Verificar backups mensualmente
- [ ] Actualizar dependencias trimestralmente
- [ ] Rotar secretos semestralmente
- [ ] Auditoría de seguridad anualmente

---

**🎉 ¡Tu servidor de actualizaciones WordPress está listo para producción!**