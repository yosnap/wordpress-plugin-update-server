<?php
/**
 * Plugin Updater Client
 * 
 * Clase para conectar plugins de WordPress con tu servidor de actualizaciones
 * 
 * @version 1.0.0
 * @author Paulo
 */

if (!class_exists('WP_Plugin_Updater')) {
    
    class WP_Plugin_Updater {
        
        private $plugin_file;
        private $plugin_slug;
        private $version;
        private $server_url;
        private $api_key;
        
        public function __construct($plugin_file, $version, $server_url, $api_key = '') {
            $this->plugin_file = $plugin_file;
            $this->plugin_slug = dirname(plugin_basename($plugin_file));
            $this->version = $version;
            $this->server_url = rtrim($server_url, '/');
            $this->api_key = $api_key;
            
            // Hooks de WordPress para el sistema de actualizaciones
            add_filter('pre_set_site_transient_update_plugins', array($this, 'check_for_update'));
            add_filter('plugins_api', array($this, 'plugin_info'), 20, 3);
        }
        
        /**
         * Verificar si hay actualizaciones disponibles
         */
        public function check_for_update($transient) {
            if (empty($transient->checked)) {
                return $transient;
            }
            
            // Solo verificar nuestro plugin
            $plugin_basename = plugin_basename($this->plugin_file);
            
            if (!isset($transient->checked[$plugin_basename])) {
                return $transient;
            }
            
            $current_version = $transient->checked[$plugin_basename];
            
            // Consultar servidor de actualizaciones
            $update_data = $this->get_update_data($current_version);
            
            if ($update_data && version_compare($current_version, $update_data['new_version'], '<')) {
                $transient->response[$plugin_basename] = (object) $update_data;
            }
            
            return $transient;
        }
        
        /**
         * Obtener información del plugin desde el servidor
         */
        public function plugin_info($result, $action, $args) {
            if ($action !== 'plugin_information') {
                return $result;
            }
            
            if (!isset($args->slug) || $args->slug !== $this->plugin_slug) {
                return $result;
            }
            
            $info_data = $this->get_plugin_info();
            
            if ($info_data) {
                return (object) $info_data;
            }
            
            return $result;
        }
        
        /**
         * Consultar datos de actualización desde el servidor
         */
        private function get_update_data($current_version) {
            $request_url = sprintf(
                '%s/api/updates/check/%s?version=%s',
                $this->server_url,
                $this->plugin_slug,
                urlencode($current_version)
            );
            
            $response = $this->make_request($request_url);
            
            if (is_wp_error($response)) {
                $this->log_error('Error verificando actualización: ' . $response->get_error_message());
                return false;
            }
            
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            
            if (!$data || isset($data['error'])) {
                return false;
            }
            
            // Si está actualizado, no devolver datos de actualización
            if (isset($data['up_to_date']) && $data['up_to_date']) {
                return false;
            }
            
            // Formatear datos para WordPress
            return array(
                'slug' => $this->plugin_slug,
                'plugin' => plugin_basename($this->plugin_file),
                'new_version' => $data['new_version'],
                'url' => $data['url'],
                'package' => $data['package'],
                'icons' => isset($data['icons']) ? $data['icons'] : array(),
                'banners' => isset($data['banners']) ? $data['banners'] : array(),
                'requires' => isset($data['requires']) ? $data['requires'] : '5.0',
                'tested' => isset($data['tested']) ? $data['tested'] : get_bloginfo('version'),
                'requires_php' => isset($data['requires_php']) ? $data['requires_php'] : '7.4',
                'upgrade_notice' => isset($data['upgrade_notice']) ? $data['upgrade_notice'] : ''
            );
        }
        
        /**
         * Obtener información completa del plugin
         */
        private function get_plugin_info() {
            $request_url = sprintf(
                '%s/api/updates/info/%s',
                $this->server_url,
                $this->plugin_slug
            );
            
            $response = $this->make_request($request_url);
            
            if (is_wp_error($response)) {
                return false;
            }
            
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            
            if (!$data || isset($data['error'])) {
                return false;
            }
            
            // Formatear datos para la ventana de información del plugin
            return array(
                'name' => $data['name'],
                'slug' => $this->plugin_slug,
                'version' => $data['latest_version'] ?? $this->version,
                'author' => $data['author'] ?? '',
                'homepage' => $data['homepage'] ?? '',
                'requires' => $data['requires_wp'] ?? '5.0',
                'tested' => $data['tested_wp'] ?? get_bloginfo('version'),
                'requires_php' => $data['requires_php'] ?? '7.4',
                'last_updated' => $data['last_updated'] ?? '',
                'sections' => array(
                    'description' => $data['description'] ?? '',
                    'changelog' => $this->format_changelog($data['versions'] ?? array())
                ),
                'download_link' => sprintf(
                    '%s/api/updates/download/%s/%s',
                    $this->server_url,
                    $this->plugin_slug,
                    $data['latest_version'] ?? $this->version
                )
            );
        }
        
        /**
         * Formatear changelog desde el array de versiones
         */
        private function format_changelog($versions) {
            if (empty($versions) || !is_array($versions)) {
                return 'No hay información de changelog disponible.';
            }
            
            $changelog = '<h4>Registro de cambios</h4>';
            
            foreach (array_slice($versions, 0, 5) as $version_data) { // Mostrar últimas 5 versiones
                if (!isset($version_data['version'])) continue;
                
                $changelog .= '<h5>Versión ' . esc_html($version_data['version']) . '</h5>';
                
                if (!empty($version_data['changelog'])) {
                    $changelog .= '<p>' . wp_kses_post($version_data['changelog']) . '</p>';
                } else {
                    $changelog .= '<p>Sin información de cambios.</p>';
                }
                
                if (!empty($version_data['release_date'])) {
                    $changelog .= '<p><em>Fecha: ' . date('d/m/Y', strtotime($version_data['release_date'])) . '</em></p>';
                }
            }
            
            return $changelog;
        }
        
        /**
         * Realizar petición HTTP al servidor
         */
        private function make_request($url) {
            $args = array(
                'timeout' => 30,
                'user-agent' => $this->get_user_agent(),
                'headers' => array(
                    'Accept' => 'application/json',
                    'X-WP-Version' => get_bloginfo('version'),
                    'X-PHP-Version' => phpversion(),
                    'X-Site-URL' => home_url()
                )
            );
            
            // Agregar API key si está configurada
            if (!empty($this->api_key)) {
                $args['headers']['Authorization'] = 'Bearer ' . $this->api_key;
            }
            
            return wp_remote_get($url, $args);
        }
        
        /**
         * Generar User-Agent personalizado
         */
        private function get_user_agent() {
            return sprintf(
                'WordPress/%s (%s); PHP/%s; Plugin/%s/%s',
                get_bloginfo('version'),
                home_url(),
                phpversion(),
                $this->plugin_slug,
                $this->version
            );
        }
        
        /**
         * Registrar errores para debugging
         */
        private function log_error($message) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log(sprintf('[%s Plugin Updater] %s', $this->plugin_slug, $message));
            }
        }
        
        /**
         * Forzar verificación de actualizaciones
         */
        public function force_check() {
            delete_site_transient('update_plugins');
            wp_update_plugins();
        }
        
        /**
         * Obtener información de versión actual
         */
        public function get_version_info() {
            return array(
                'plugin_slug' => $this->plugin_slug,
                'current_version' => $this->version,
                'server_url' => $this->server_url,
                'has_api_key' => !empty($this->api_key)
            );
        }
    }
}