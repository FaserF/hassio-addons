#!/usr/bin/env bashio

#VARIABLES
hyperionrelease="2.0.0-alpha.5"
hyperionreleasename="Hyperion-2.0.0-alpha.5-Linux"
architecture_details=$(uname -a)
if [[ $architecture_details == *"armv7"* ]]; then
  architecture="armv7hf-rpi.sh"
elif [[ $architecture_details == *"armv6"* ]]; then
  architecture="armv6hf-rpi.sh"
elif [[ $architecture_details == *"i386"* ]]; then
  architecture="i386-x11.sh"
elif [[ $architecture_details == *"x86_64"* ]]; then
  architecture="amd64-x11.sh"
else
  echo "Unkown architecture. Programm will now exit."
  exit
fi

echo "HyperionNG Homeassistant Add-On"
echo "for more informations or bugs with hyperionng itself please visit: https://github.com/hyperion-project/hyperion.ng"

if [ ! -d /data/hyperionng/share/ ]; then
    echo "Downloading hyperion.ng for architecture $architecture"
    wget https://github.com/hyperion-project/hyperion.ng/releases/download/$hyperionrelease/$hyperionreleasename-$architecture >/dev/null 2>&1
    echo "Extracting content"
    mkdir -p /data/hyperionng/
    bash ./$hyperionreleasename-$architecture --prefix=/data/hyperionng/ --exclude-subdir
    echo "Setting permissions"
    chmod +x /data/hyperionng/share/hyperion/bin/hyperiond
else
    echo "HyperionNG ist already installed"
    echo "If you want to reinstall it, please reinstall this addon"
fi

echo "Starting HyperionNG. You can access your Hyperion afterwards by typing in the following URL in your webbrowser: unknown"
./data/hyperionng/share/hyperion/bin/hyperiond
#while sleep 3600; do :; done