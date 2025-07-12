-- Tabla de plugins
CREATE TABLE IF NOT EXISTS plugins (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    author VARCHAR(255),
    github_repo VARCHAR(255) NOT NULL,
    github_owner VARCHAR(255) NOT NULL,
    homepage VARCHAR(255),
    requires_wp VARCHAR(50),
    tested_wp VARCHAR(50),
    requires_php VARCHAR(50),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de versiones
CREATE TABLE IF NOT EXISTS plugin_versions (
    id SERIAL PRIMARY KEY,
    plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    download_url VARCHAR(500),
    file_path VARCHAR(500),
    file_size BIGINT,
    changelog TEXT,
    release_notes TEXT,
    github_tag VARCHAR(100),
    github_release_id BIGINT,
    is_prerelease BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plugin_id, version)
);

-- Tabla de descargas (estadísticas)
CREATE TABLE IF NOT EXISTS downloads (
    id SERIAL PRIMARY KEY,
    plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
    version_id INTEGER REFERENCES plugin_versions(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    wp_version VARCHAR(50),
    php_version VARCHAR(50),
    site_url VARCHAR(500),
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de usuarios/sitios autorizados (opcional)
CREATE TABLE IF NOT EXISTS authorized_sites (
    id SERIAL PRIMARY KEY,
    site_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_check TIMESTAMP
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_plugins_slug ON plugins(slug);
CREATE INDEX IF NOT EXISTS idx_plugin_versions_plugin_id ON plugin_versions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_versions_version ON plugin_versions(version);
CREATE INDEX IF NOT EXISTS idx_downloads_plugin_id ON downloads(plugin_id);
CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON downloads(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_authorized_sites_api_key ON authorized_sites(api_key);

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar timestamp automáticamente
CREATE TRIGGER update_plugins_updated_at 
    BEFORE UPDATE ON plugins 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();