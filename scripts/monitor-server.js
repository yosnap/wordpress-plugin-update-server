#!/usr/bin/env node

/**
 * Script de monitoreo del servidor de actualizaciones
 * 
 * Uso: node monitor-server.js [server-url]
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ServerMonitor {
  constructor(serverUrl) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.alertThresholds = {
      responseTime: 5000, // 5 segundos
      errorRate: 0.1, // 10%
      memoryUsage: 90, // 90%
      diskUsage: 85 // 85%
    };
    this.checks = [];
  }

  async runMonitoring() {
    console.log(`🔍 Iniciando monitoreo del servidor: ${this.serverUrl}\n`);

    while (true) {
      try {
        await this.performChecks();
        await this.sleep(30000); // Check cada 30 segundos
      } catch (error) {
        console.error('❌ Error en monitoreo:', error.message);
        await this.sleep(5000); // Reintentar en 5 segundos si hay error
      }
    }
  }

  async performChecks() {
    const timestamp = new Date().toISOString();
    
    try {
      // Health check
      const healthResult = await this.checkHealth();
      
      // Métricas en tiempo real
      const metricsResult = await this.checkMetrics();
      
      // Dashboard completo (si tenemos token admin)
      const dashboardResult = await this.checkDashboard();
      
      const overallStatus = this.evaluateOverallStatus([
        healthResult, 
        metricsResult, 
        dashboardResult
      ]);
      
      // Log del estado
      this.logStatus(timestamp, overallStatus, {
        health: healthResult,
        metrics: metricsResult,
        dashboard: dashboardResult
      });
      
      // Generar alertas si es necesario
      if (overallStatus.status !== 'healthy') {
        this.generateAlert(overallStatus);
      }
      
    } catch (error) {
      this.logStatus(timestamp, {
        status: 'error',
        message: error.message
      });
    }
  }

  async checkHealth() {
    try {
      const start = Date.now();
      const response = await axios.get(`${this.serverUrl}/api/monitoring/health`, {
        timeout: 10000
      });
      const responseTime = Date.now() - start;
      
      return {
        endpoint: 'health',
        status: response.data.status,
        responseTime,
        checks: response.data.checks,
        healthy: response.status === 200
      };
    } catch (error) {
      return {
        endpoint: 'health',
        status: 'error',
        error: error.message,
        healthy: false
      };
    }
  }

  async checkMetrics() {
    try {
      const start = Date.now();
      const response = await axios.get(`${this.serverUrl}/api/monitoring/metrics`, {
        timeout: 10000
      });
      const responseTime = Date.now() - start;
      
      const metrics = response.data;
      const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
      
      return {
        endpoint: 'metrics',
        status: 'healthy',
        responseTime,
        uptime: metrics.uptime,
        memoryUsage: memoryUsagePercent,
        activeConnections: metrics.activeConnections,
        recentActivity: metrics.recentActivity,
        healthy: memoryUsagePercent < this.alertThresholds.memoryUsage
      };
    } catch (error) {
      return {
        endpoint: 'metrics',
        status: 'error',
        error: error.message,
        healthy: false
      };
    }
  }

  async checkDashboard() {
    // Solo intentar si tenemos token de admin
    const adminToken = process.env.ADMIN_TOKEN;
    
    if (!adminToken) {
      return {
        endpoint: 'dashboard',
        status: 'skipped',
        message: 'No admin token provided',
        healthy: true
      };
    }

    try {
      const start = Date.now();
      const response = await axios.get(`${this.serverUrl}/api/monitoring/dashboard`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        timeout: 15000
      });
      const responseTime = Date.now() - start;
      
      return {
        endpoint: 'dashboard',
        status: 'healthy',
        responseTime,
        data: response.data,
        healthy: true
      };
    } catch (error) {
      return {
        endpoint: 'dashboard',
        status: 'error',
        error: error.message,
        healthy: false
      };
    }
  }

  evaluateOverallStatus(results) {
    const healthyCount = results.filter(r => r.healthy).length;
    const totalCount = results.length;
    const healthPercentage = (healthyCount / totalCount) * 100;
    
    let status = 'healthy';
    let message = 'All systems operational';
    
    if (healthPercentage < 100) {
      status = 'degraded';
      message = `${totalCount - healthyCount} of ${totalCount} checks failing`;
    }
    
    if (healthPercentage < 50) {
      status = 'unhealthy';
      message = 'Multiple system failures detected';
    }
    
    // Verificar umbrales específicos
    const metricsResult = results.find(r => r.endpoint === 'metrics');
    if (metricsResult && metricsResult.memoryUsage > this.alertThresholds.memoryUsage) {
      status = 'warning';
      message = `High memory usage: ${metricsResult.memoryUsage.toFixed(1)}%`;
    }
    
    return {
      status,
      message,
      healthPercentage,
      timestamp: new Date().toISOString()
    };
  }

  logStatus(timestamp, overallStatus, details = {}) {
    const statusIcon = {
      'healthy': '✅',
      'warning': '⚠️',
      'degraded': '🟡',
      'unhealthy': '❌',
      'error': '💥'
    };
    
    const icon = statusIcon[overallStatus.status] || '❓';
    
    console.log(`${timestamp} ${icon} ${overallStatus.status.toUpperCase()}: ${overallStatus.message}`);
    
    // Log detalles de cada check
    Object.entries(details).forEach(([key, result]) => {
      if (result && result.endpoint) {
        const resultIcon = result.healthy ? '✅' : '❌';
        const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
        console.log(`  ${resultIcon} ${result.endpoint}${responseTime}: ${result.status}`);
        
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      }
    });
    
    console.log(''); // Línea en blanco para separar checks
    
    // Guardar en archivo de log si está configurado
    this.saveToLogFile({
      timestamp,
      overallStatus,
      details
    });
  }

  generateAlert(status) {
    // Evitar spam de alertas
    const now = Date.now();
    const lastAlert = this.lastAlertTime || 0;
    const alertCooldown = 5 * 60 * 1000; // 5 minutos
    
    if (now - lastAlert < alertCooldown) {
      return;
    }
    
    console.log('\n🚨 ALERTA GENERADA 🚨');
    console.log(`Estado: ${status.status}`);
    console.log(`Mensaje: ${status.message}`);
    console.log(`Timestamp: ${status.timestamp}`);
    
    // Aquí puedes agregar integración con servicios de alerta
    // como Slack, Discord, email, etc.
    this.sendWebhookAlert(status);
    
    this.lastAlertTime = now;
  }

  async sendWebhookAlert(status) {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    
    if (!webhookUrl) {
      return;
    }
    
    try {
      const payload = {
        text: `🚨 Servidor de Actualizaciones WordPress - ${status.status.toUpperCase()}`,
        attachments: [{
          color: status.status === 'unhealthy' ? 'danger' : 'warning',
          fields: [{
            title: 'Estado',
            value: status.message,
            short: true
          }, {
            title: 'Servidor',
            value: this.serverUrl,
            short: true
          }, {
            title: 'Timestamp',
            value: status.timestamp,
            short: false
          }]
        }]
      };
      
      await axios.post(webhookUrl, payload, {
        timeout: 5000
      });
      
      console.log('📤 Alerta enviada via webhook');
    } catch (error) {
      console.log('❌ Error enviando alerta:', error.message);
    }
  }

  saveToLogFile(data) {
    const logFile = process.env.MONITOR_LOG_FILE;
    
    if (!logFile) {
      return;
    }
    
    try {
      const logEntry = JSON.stringify(data) + '\n';
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      // No mostrar error para evitar spam
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const serverUrl = process.argv[2] || process.env.SERVER_URL || 'http://localhost:3000';
  
  console.log('📊 Monitor del Servidor de Actualizaciones WordPress');
  console.log('=' .repeat(50));
  console.log(`Servidor: ${serverUrl}`);
  console.log(`Intervalo: 30 segundos`);
  console.log(`Admin Token: ${process.env.ADMIN_TOKEN ? 'Configurado' : 'No configurado'}`);
  console.log(`Webhook Alertas: ${process.env.ALERT_WEBHOOK_URL ? 'Configurado' : 'No configurado'}`);
  console.log(`Log File: ${process.env.MONITOR_LOG_FILE || 'No configurado'}`);
  console.log('=' .repeat(50));
  console.log('');
  
  const monitor = new ServerMonitor(serverUrl);
  
  // Manejar Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n👋 Deteniendo monitoreo...');
    process.exit(0);
  });
  
  await monitor.runMonitoring();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Error fatal en monitor:', error.message);
    process.exit(1);
  });
}