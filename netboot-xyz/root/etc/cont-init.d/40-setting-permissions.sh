#!/usr/bin/with-contenv bashio
path=$(bashio::config 'path')
path_config=$(bashio::config 'path_config')

chmod -R 777 /assets
chmod -R 777 /$path
chmod -R 777 /config
chmod -R 777 /$path_config
chown -R abc:abc /config
chown -R abc:abc /assets