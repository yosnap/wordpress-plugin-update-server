<?php
/**
 * Ejemplo de cómo integrar el Plugin Updater en tus plugins existentes
 * 
 * Copia este código y modifícalo según tu plugin
 */

// ==========================================
// OPCIÓN 1: Integración básica en el archivo principal del plugin
// ==========================================

/**
 * Plugin Name: Mi Plugin Increíble
 * Description: Un plugin que hace cosas increíbles
 * Version: 1.2.3
 * Author: Paulo
 * GitHub Plugin URI: tu-usuario/mi-plugin-increible
 */

// Prevenir acceso directo
if (!defined('ABSPATH')) {
    exit;
}

// Definir constantes del plugin
define('MI_PLUGIN_VERSION', '1.2.3');
define('MI_PLUGIN_FILE', __FILE__);
define('MI_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('MI_PLUGIN_URL', plugin_dir_url(__FILE__));

// Incluir el sistema de actualizaciones
require_once MI_PLUGIN_PATH . 'includes/class-plugin-updater.php';

// Inicializar el updater
function mi_plugin_init_updater() {
    // URL de tu servidor de actualizaciones
    $server_url = 'https://tu-servidor.com'; // Cambiar por tu URL
    
    // API key (opcional, para autenticación)
    $api_key = ''; // Dejar vacío si no usas autenticación
    
    // Inicializar updater
    new WP_Plugin_Updater(
        MI_PLUGIN_FILE,      // Archivo principal del plugin
        MI_PLUGIN_VERSION,   // Versión actual
        $server_url,         // URL del servidor
        $api_key            // API key (opcional)
    );
}

// Hook para inicializar después de que WordPress esté listo
add_action('init', 'mi_plugin_init_updater');

// ==========================================
// OPCIÓN 2: Integración usando clase principal del plugin
// ==========================================

class MiPluginPrincipal {
    
    private $version = '1.2.3';
    private $plugin_file;
    private $updater;
    
    public function __construct($plugin_file) {
        $this->plugin_file = $plugin_file;
        
        // Hooks de WordPress
        add_action('init', array($this, 'init'));
        add_action('admin_init', array($this, 'init_updater'));
    }
    
    public function init() {
        // Lógica principal del plugin...
    }
    
    public function init_updater() {
        // Solo cargar en admin
        if (!is_admin()) {
            return;
        }
        
        // Incluir clase updater
        require_once plugin_dir_path($this->plugin_file) . 'includes/class-plugin-updater.php';
        
        // Configuración del servidor
        $server_url = 'https://tu-servidor.com';
        $api_key = get_option('mi_plugin_api_key', ''); // Desde opciones
        
        // Inicializar updater
        $this->updater = new WP_Plugin_Updater(
            $this->plugin_file,
            $this->version,
            $server_url,
            $api_key
        );
    }
    
    // Método para forzar verificación (útil para debugging)
    public function force_update_check() {
        if ($this->updater) {
            $this->updater->force_check();
        }
    }
}

// Inicializar plugin
new MiPluginPrincipal(__FILE__);

// ==========================================
// OPCIÓN 3: Panel de administración con información del updater
// ==========================================

// Agregar página de configuración
add_action('admin_menu', 'mi_plugin_admin_menu');

function mi_plugin_admin_menu() {
    add_options_page(
        'Mi Plugin - Actualizaciones',
        'Mi Plugin Updates',
        'manage_options',
        'mi-plugin-updates',
        'mi_plugin_updates_page'
    );
}

function mi_plugin_updates_page() {
    // Obtener información del updater
    global $mi_plugin_updater; // Variable global donde guardaste el updater
    
    if (isset($_POST['force_check']) && wp_verify_nonce($_POST['_wpnonce'], 'force_check')) {
        if ($mi_plugin_updater) {
            $mi_plugin_updater->force_check();
            echo '<div class="notice notice-success"><p>Verificación de actualizaciones forzada.</p></div>';
        }
    }
    
    ?>
    <div class="wrap">
        <h1>Actualizaciones de Mi Plugin</h1>
        
        <?php if ($mi_plugin_updater): ?>
            <?php $info = $mi_plugin_updater->get_version_info(); ?>
            <table class="form-table">
                <tr>
                    <th>Plugin Slug</th>
                    <td><?php echo esc_html($info['plugin_slug']); ?></td>
                </tr>
                <tr>
                    <th>Versión Actual</th>
                    <td><?php echo esc_html($info['current_version']); ?></td>
                </tr>
                <tr>
                    <th>Servidor de Actualizaciones</th>
                    <td><?php echo esc_html($info['server_url']); ?></td>
                </tr>
                <tr>
                    <th>API Key Configurada</th>
                    <td><?php echo $info['has_api_key'] ? '✅ Sí' : '❌ No'; ?></td>
                </tr>
            </table>
            
            <form method="post">
                <?php wp_nonce_field('force_check'); ?>
                <p>
                    <input type="submit" name="force_check" class="button button-secondary" 
                           value="Forzar Verificación de Actualizaciones" />
                </p>
            </form>
        <?php else: ?>
            <p>Sistema de actualizaciones no inicializado.</p>
        <?php endif; ?>
    </div>
    <?php
}

// ==========================================
// CONFIGURACIÓN AVANZADA CON OPCIONES
// ==========================================

// Configurar API key desde opciones de WordPress
function mi_plugin_configurar_updater_avanzado() {
    // Obtener configuración guardada
    $config = get_option('mi_plugin_updater_config', array(
        'server_url' => 'https://tu-servidor.com',
        'api_key' => '',
        'auto_update' => false
    ));
    
    require_once plugin_dir_path(__FILE__) . 'includes/class-plugin-updater.php';
    
    $updater = new WP_Plugin_Updater(
        __FILE__,
        MI_PLUGIN_VERSION,
        $config['server_url'],
        $config['api_key']
    );
    
    // Guardar referencia global para usar en otras funciones
    global $mi_plugin_updater;
    $mi_plugin_updater = $updater;
    
    return $updater;
}

// ==========================================
// REGISTRO EN EL SERVIDOR (SCRIPT PARA EJECUTAR UNA VEZ)
// ==========================================

function mi_plugin_registrar_en_servidor() {
    $server_url = 'https://tu-servidor.com';
    
    $plugin_data = array(
        'slug' => 'mi-plugin-increible',
        'name' => 'Mi Plugin Increíble',
        'description' => 'Un plugin que hace cosas increíbles',
        'author' => 'Paulo',
        'github_repo' => 'mi-plugin-increible',
        'github_owner' => 'tu-usuario',
        'homepage' => 'https://tu-sitio.com/plugins/mi-plugin',
        'requires_wp' => '5.0',
        'tested_wp' => '6.3',
        'requires_php' => '7.4'
    );
    
    $response = wp_remote_post($server_url . '/api/plugins', array(
        'headers' => array(
            'Content-Type' => 'application/json'
        ),
        'body' => json_encode($plugin_data),
        'timeout' => 30
    ));
    
    if (is_wp_error($response)) {
        error_log('Error registrando plugin: ' . $response->get_error_message());
        return false;
    }
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if (isset($data['error'])) {
        error_log('Error del servidor: ' . $data['error']);
        return false;
    }
    
    return true;
}

// Ejecutar registro solo una vez (puedes llamar esta función manualmente)
// mi_plugin_registrar_en_servidor();
?>