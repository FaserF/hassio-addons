#!/usr/bin/with-contenv bashio
path=$(bashio::config 'path')
path_config=$(bashio::config 'path_config')

echo "Linking folder $path to /assets and $path_config to /config."

ln -s $path /assets
ln -s $path_config /config

if [ -d $path_config ]; then
    echo "The following cutom configs were found:"
    ls -l $path_config
else
    echo "Looks like the path $path_config from your config is empty! We will still start the addon with default options!"
fi

if [ -d $path ]; then
    echo "The following ISOs and files were found:"
    ls -l $path
else
    echo "Looks like the path $path from is empty! Are you sure that you want to use this addon without a ISO etc?"
fi