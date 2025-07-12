#!/usr/bin/env node

/**
 * Script para registrar plugins en el servidor de actualizaciones
 * 
 * Uso: node register-plugin.js
 */

const readline = require('readline');
const axios = require('axios');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function registerPlugin() {
  console.log('🚀 Registro de Plugin en Servidor de Actualizaciones\n');
  
  try {
    // Recopilar información del plugin
    const serverUrl = await question('URL del servidor (ej: https://tu-servidor.com): ');
    const slug = await question('Slug del plugin (ej: mi-plugin-increible): ');
    const name = await question('Nombre del plugin (ej: Mi Plugin Increíble): ');
    const description = await question('Descripción del plugin: ');
    const author = await question('Autor del plugin: ');
    const githubOwner = await question('Usuario/Organización de GitHub: ');
    const githubRepo = await question('Nombre del repositorio en GitHub: ');
    const homepage = await question('Página web del plugin (opcional): ');
    const requiresWp = await question('Versión mínima de WordPress (ej: 5.0): ') || '5.0';
    const testedWp = await question('Probado hasta WordPress (ej: 6.3): ') || '6.3';
    const requiresPhp = await question('Versión mínima de PHP (ej: 7.4): ') || '7.4';
    
    console.log('\n📝 Datos del plugin:');
    console.log(`Slug: ${slug}`);
    console.log(`Nombre: ${name}`);
    console.log(`GitHub: ${githubOwner}/${githubRepo}`);
    console.log(`Servidor: ${serverUrl}`);
    
    const confirm = await question('\n¿Registrar plugin? (y/N): ');
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Registro cancelado');
      rl.close();
      return;
    }
    
    // Preparar datos para envío
    const pluginData = {
      slug,
      name,
      description,
      author,
      github_repo: githubRepo,
      github_owner: githubOwner,
      homepage: homepage || null,
      requires_wp: requiresWp,
      tested_wp: testedWp,
      requires_php: requiresPhp
    };
    
    console.log('\n⏳ Registrando plugin...');
    
    // Enviar solicitud al servidor
    const response = await axios.post(`${serverUrl}/api/plugins`, pluginData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ Plugin registrado exitosamente!');
    console.log('\n📊 Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n🎯 Próximos pasos:');
    console.log('1. Configura el webhook en GitHub:');
    console.log(`   URL: ${serverUrl}/api/webhooks/github`);
    console.log('   Events: Releases');
    console.log('2. Agrega el código updater a tu plugin');
    console.log('3. Crea un release en GitHub para probar');
    
  } catch (error) {
    console.error('❌ Error registrando plugin:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('Error de conexión:', error.message);
    } else {
      console.error('Error:', error.message);
    }
  }
  
  rl.close();
}

async function main() {
  try {
    await registerPlugin();
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
  }
}

if (require.main === module) {
  main();
}