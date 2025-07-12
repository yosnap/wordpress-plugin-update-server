#!/usr/bin/env node

/**
 * Script para probar el servidor de actualizaciones
 * 
 * Uso: node test-server.js
 */

const axios = require('axios');

class ServerTester {
  constructor(serverUrl) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remover trailing slash
    this.results = [];
  }

  async runTest(name, testFunction) {
    console.log(`🔍 Probando: ${name}`);
    
    try {
      const result = await testFunction();
      this.results.push({ name, status: 'PASS', result });
      console.log(`✅ ${name}: PASS`);
      return result;
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ ${name}: FAIL - ${error.message}`);
      return null;
    }
  }

  async testServerHealth() {
    const response = await axios.get(`${this.serverUrl}/health`, { timeout: 10000 });
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    return response.data;
  }

  async testServerInfo() {
    const response = await axios.get(`${this.serverUrl}/`, { timeout: 10000 });
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    return response.data;
  }

  async testWebhookStatus() {
    const response = await axios.get(`${this.serverUrl}/api/webhooks/status`, { timeout: 10000 });
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    return response.data;
  }

  async testPluginsList() {
    const response = await axios.get(`${this.serverUrl}/api/plugins`, { timeout: 10000 });
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    return response.data;
  }

  async testDatabaseConnection() {
    // Test indirecto: si plugins endpoint funciona, la DB está conectada
    await this.testPluginsList();
    return { connected: true };
  }

  async testCreateTestPlugin() {
    const testPlugin = {
      slug: 'test-plugin-' + Date.now(),
      name: 'Plugin de Prueba',
      description: 'Plugin creado para testing',
      author: 'Test',
      github_repo: 'test-repo',
      github_owner: 'test-owner'
    };

    const response = await axios.post(
      `${this.serverUrl}/api/plugins`, 
      testPlugin,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.status !== 201) {
      throw new Error(`Expected 201, got ${response.status}`);
    }

    return { ...response.data, test_plugin: true };
  }

  async testUpdateCheck(pluginSlug) {
    const response = await axios.get(
      `${this.serverUrl}/api/updates/check/${pluginSlug}?version=0.0.1`,
      { timeout: 10000 }
    );

    if (response.status !== 200 && response.status !== 404) {
      throw new Error(`Expected 200 or 404, got ${response.status}`);
    }

    return response.data;
  }

  async testInvalidEndpoint() {
    try {
      await axios.get(`${this.serverUrl}/api/invalid-endpoint`, { timeout: 10000 });
      throw new Error('Expected 404 but got success');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return { error_handling: 'OK' };
      }
      throw error;
    }
  }

  async cleanupTestPlugin(pluginSlug) {
    try {
      await axios.delete(`${this.serverUrl}/api/plugins/${pluginSlug}`, { timeout: 10000 });
      console.log(`🧹 Plugin de prueba ${pluginSlug} eliminado`);
    } catch (error) {
      console.log(`⚠️  No se pudo eliminar plugin de prueba: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log(`🚀 Iniciando pruebas del servidor: ${this.serverUrl}\n`);

    let testPlugin = null;

    // Tests básicos
    await this.runTest('Conectividad del servidor', () => this.testServerHealth());
    await this.runTest('Información del servidor', () => this.testServerInfo());
    await this.runTest('Estado de webhooks', () => this.testWebhookStatus());
    await this.runTest('Conexión a base de datos', () => this.testDatabaseConnection());
    await this.runTest('Lista de plugins', () => this.testPluginsList());

    // Tests funcionales
    testPlugin = await this.runTest('Crear plugin de prueba', () => this.testCreateTestPlugin());
    
    if (testPlugin && testPlugin.slug) {
      await this.runTest('Verificar actualización', () => this.testUpdateCheck(testPlugin.slug));
    }

    await this.runTest('Manejo de errores', () => this.testInvalidEndpoint());

    // Cleanup
    if (testPlugin && testPlugin.slug) {
      await this.cleanupTestPlugin(testPlugin.slug);
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 RESUMEN DE PRUEBAS');
    console.log('=====================');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    console.log(`Total: ${total}`);
    console.log(`Exitosas: ${passed} ✅`);
    console.log(`Fallidas: ${failed} ❌`);
    console.log(`Porcentaje: ${Math.round((passed / total) * 100)}%`);

    if (failed > 0) {
      console.log('\n❌ PRUEBAS FALLIDAS:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }

    console.log('\n' + (failed === 0 ? '🎉 Todas las pruebas pasaron!' : '⚠️  Algunas pruebas fallaron'));
  }
}

async function main() {
  const serverUrl = process.argv[2] || 'http://localhost:3000';
  
  console.log('🧪 Test Suite del Servidor de Actualizaciones WordPress\n');
  
  const tester = new ServerTester(serverUrl);
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Error ejecutando pruebas:', error.message);
    process.exit(1);
  });
}