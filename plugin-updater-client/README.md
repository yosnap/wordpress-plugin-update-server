# Plugin Updater Client para WordPress

Cliente PHP para conectar tus plugins de WordPress con tu servidor de actualizaciones automáticas.

## 🚀 Instalación Rápida

### 1. Copia los archivos a tu plugin

```
mi-plugin/
├── mi-plugin.php (archivo principal)
├── includes/
│   └── class-plugin-updater.php  ← Copia este archivo aquí
└── ...
```

### 2. Modifica tu plugin principal

```php
<?php
/**
 * Plugin Name: Mi Plugin
 * Version: 1.0.0
 */

define('MI_PLUGIN_VERSION', '1.0.0');

// Incluir updater
require_once plugin_dir_path(__FILE__) . 'includes/class-plugin-updater.php';

// Inicializar updater
function mi_plugin_init_updater() {
    new WP_Plugin_Updater(
        __FILE__,                          // Archivo del plugin
        MI_PLUGIN_VERSION,                 // Versión actual
        'https://tu-servidor.com',         // URL de tu servidor
        ''                                 // API key (opcional)
    );
}
add_action('init', 'mi_plugin_init_updater');
```

### 3. Registra tu plugin en el servidor

```bash
# POST a tu servidor
curl -X POST https://tu-servidor.com/api/plugins \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "mi-plugin",
    "name": "Mi Plugin",
    "github_owner": "tu-usuario",
    "github_repo": "mi-plugin",
    "description": "Descripción del plugin"
  }'
```

## 📋 Configuración del Plugin

### Parámetros del Constructor

```php
new WP_Plugin_Updater($plugin_file, $version, $server_url, $api_key);
```

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `$plugin_file` | Archivo principal del plugin | `__FILE__` |
| `$version` | Versión actual del plugin | `'1.2.3'` |
| `$server_url` | URL de tu servidor | `'https://updates.mi-sitio.com'` |
| `$api_key` | Clave API (opcional) | `'abc123...'` |

### Variables que WordPress envía automáticamente

El updater envía información útil a tu servidor:

- **X-WP-Version**: Versión de WordPress
- **X-PHP-Version**: Versión de PHP  
- **X-Site-URL**: URL del sitio
- **User-Agent**: Info completa del entorno

## 🔄 Flujo de Actualización

1. **WordPress verifica actualizaciones** (cada 12 horas)
2. **Tu plugin consulta**: `GET /api/updates/check/mi-plugin?version=1.0.0`
3. **Servidor responde** con info de nueva versión o "actualizado"
4. **WordPress muestra notificación** si hay actualización
5. **Usuario actualiza**: descarga desde `/api/updates/download/mi-plugin/1.1.0`

## 🛠️ Métodos Disponibles

### `force_check()`
Fuerza verificación inmediata de actualizaciones:

```php
global $mi_plugin_updater;
$mi_plugin_updater->force_check();
```

### `get_version_info()`
Obtiene información del estado actual:

```php
$info = $mi_plugin_updater->get_version_info();
// Returns:
// [
//   'plugin_slug' => 'mi-plugin',
//   'current_version' => '1.0.0', 
//   'server_url' => 'https://...',
//   'has_api_key' => false
// ]
```

## 🔧 Configuración Avanzada

### Con API Key

```php
// Obtener API key desde opciones de WordPress
$api_key = get_option('mi_plugin_api_key', '');

new WP_Plugin_Updater(__FILE__, VERSION, SERVER_URL, $api_key);
```

### Panel de Administración

```php
// Agregar página de configuración
add_action('admin_menu', 'mi_plugin_admin_menu');

function mi_plugin_admin_menu() {
    add_options_page(
        'Mi Plugin Updates',
        'Updates',
        'manage_options',
        'mi-plugin-updates',
        'mi_plugin_admin_page'
    );
}

function mi_plugin_admin_page() {
    global $mi_plugin_updater;
    $info = $mi_plugin_updater->get_version_info();
    
    echo '<h1>Estado de Actualizaciones</h1>';
    echo '<p>Versión: ' . $info['current_version'] . '</p>';
    echo '<p>Servidor: ' . $info['server_url'] . '</p>';
}
```

### Configuración desde Base de Datos

```php
function mi_plugin_init_updater_db() {
    $config = get_option('mi_plugin_updater', [
        'server_url' => 'https://updates.mi-sitio.com',
        'api_key' => '',
        'enabled' => true
    ]);
    
    if ($config['enabled']) {
        new WP_Plugin_Updater(
            __FILE__,
            VERSION,
            $config['server_url'],
            $config['api_key']
        );
    }
}
```

## 🐛 Debugging

### Habilitar Logs

```php
// En wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

Los errores se registrarán en `/wp-content/debug.log`:

```
[mi-plugin Plugin Updater] Error verificando actualización: HTTP 404
```

### Verificar Estado Manualmente

```php
// En functions.php temporalmente
add_action('wp_footer', function() {
    if (current_user_can('manage_options')) {
        global $mi_plugin_updater;
        if ($mi_plugin_updater) {
            $info = $mi_plugin_updater->get_version_info();
            echo '<pre style="background:black;color:white;padding:10px;">';
            print_r($info);
            echo '</pre>';
        }
    }
});
```

## 📡 Registro Automático en el Servidor

```php
function mi_plugin_auto_register() {
    $registered = get_option('mi_plugin_registered', false);
    
    if (!$registered) {
        $success = mi_plugin_registrar_en_servidor(); // Función del ejemplo
        if ($success) {
            update_option('mi_plugin_registered', true);
        }
    }
}

// Ejecutar en activación del plugin
register_activation_hook(__FILE__, 'mi_plugin_auto_register');
```

## ⚠️ Consideraciones Importantes

1. **Slug único**: Asegúrate de que el slug del plugin sea único
2. **Versionado semántico**: Usa formato `1.2.3` para versiones
3. **GitHub releases**: Crea releases con tags para activar webhooks
4. **Seguridad**: Usa HTTPS para tu servidor de actualizaciones
5. **Rate limiting**: El cliente respeta los límites de WordPress (verificación cada 12h)

## 🔄 Migración desde WordPress.org

Si tienes un plugin en el repositorio oficial y quieres migrar:

1. **Mantén ambos sistemas** temporalmente
2. **Incrementa versión** en tu servidor primero
3. **Agrega aviso** en la descripción del plugin oficial
4. **Migra usuarios** gradualmente

## 📞 Soporte

- Revisa los logs de WordPress (`/wp-content/debug.log`)
- Verifica conectividad: `curl https://tu-servidor.com/health`
- Prueba endpoints manualmente: `/api/updates/check/mi-plugin?version=1.0.0`