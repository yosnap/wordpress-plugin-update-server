#!/usr/bin/env node

/**
 * Script para configurar credenciales de administrador
 * 
 * Uso: node setup-admin.js
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
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

function hideInput() {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  let password = '';
  
  return new Promise((resolve) => {
    process.stdin.on('data', function(ch) {
      ch = ch + '';
      
      switch(ch) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u0008':
        case '\u007f':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += ch;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function setupAdmin() {
  console.log('🔐 Configuración de Administrador del Servidor\n');
  
  try {
    const serverUrl = await question('URL del servidor (ej: http://localhost:3000): ');
    const username = await question('Nombre de usuario admin (admin): ') || 'admin';
    
    console.log('Password (no se mostrará): ');
    const password = await hideInput();
    
    if (!password || password.length < 6) {
      console.log('❌ Password debe tener al menos 6 caracteres');
      rl.close();
      return;
    }
    
    console.log('\n📝 Generando hash seguro...');
    
    // Generar hash de la password
    const hash = await bcrypt.hash(password, 12);
    
    console.log('\n✅ Hash generado exitosamente!');
    console.log('\n🔧 Configuración para tu archivo .env:');
    console.log('='.repeat(50));
    console.log(`ADMIN_USERNAME=${username}`);
    console.log(`ADMIN_PASSWORD=${hash}`);
    console.log('='.repeat(50));
    
    // Intentar probar el login si el servidor está disponible
    const testLogin = await question('\n¿Probar login en el servidor? (y/N): ');
    
    if (testLogin.toLowerCase() === 'y' || testLogin.toLowerCase() === 'yes') {
      console.log('\n⏳ Probando login...');
      
      try {
        const response = await axios.post(`${serverUrl}/api/auth/admin/login`, {
          username,
          password
        }, {
          timeout: 10000
        });
        
        console.log('✅ Login exitoso!');
        console.log(`Token: ${response.data.token.substring(0, 20)}...`);
        console.log(`Expira en: ${response.data.expiresIn}`);
        
      } catch (error) {
        if (error.response) {
          console.log('❌ Error de login:', error.response.data.error);
          console.log('💡 Asegúrate de que las credenciales estén configuradas en el .env del servidor');
        } else {
          console.log('❌ Error de conexión:', error.message);
          console.log('💡 Verifica que el servidor esté ejecutándose');
        }
      }
    }
    
    console.log('\n📋 Próximos pasos:');
    console.log('1. Agrega las credenciales a tu archivo .env');
    console.log('2. Reinicia el servidor si está ejecutándose');
    console.log('3. Usa POST /api/auth/admin/login para obtener tokens');
    console.log('4. Incluye el token en header: Authorization: Bearer <token>');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  rl.close();
}

async function quickHash() {
  const password = process.argv[3];
  
  if (!password) {
    console.log('Uso: node setup-admin.js hash <password>');
    return;
  }
  
  const hash = await bcrypt.hash(password, 12);
  console.log(`ADMIN_PASSWORD=${hash}`);
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'hash') {
    await quickHash();
  } else {
    await setupAdmin();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}