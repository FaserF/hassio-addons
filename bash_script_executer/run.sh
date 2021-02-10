#!/usr/bin/env bashio
script_path=$(bashio::config 'script_path')
script_path2=$(bashio::config 'script_path2')
script_path3=$(bashio::config 'script_path3')

if [ $script_path != "false" ]; then
  if [ ! -f $script_path ]; then
    echo "Cant find your first script at $script_path"
    echo "Exiting now..."
    exit 1
  fi
fi

if [ $script_path2 != "false" ]; then
  if [ ! -f $script_path2 ]; then
    echo "Cant find your second script at $script_path2"
    echo "Exiting now..."
    exit 1
  fi
fi

if [ $script_path3 != "false" ]; then
  if [ ! -f $script_path3 ]; then
    echo "Cant find your third script at $script_path3"
    echo "Exiting now..."
    exit 1
  fi
fi

#Set 711 rights to script
echo "Fixing permissions."
if [ $script_path != "false" ]; then
  find $script_path -type d -exec chmod 711 {} \;
fi
if [ $script_path2 != "false" ]; then
  find $script_path2 -type d -exec chmod 711 {} \;
fi
if [ $script_path3 != "false" ]; then
  find $script_path3 -type d -exec chmod 711 {} \;
fi

if [ $script_path != "false" ]; then
  echo "Executing the first script now..."
  echo "-----"
  bash $script_path
fi

if [ $script_path2 != "false" ]; then
  echo "Executing the second script now..."
  echo "-----"
  bash $script_path2
fi

if [ $script_path3 != "false" ]; then
  echo "Executing the third script now..."
  echo "-----"
  bash $script_path3
fi

echo "----------"
echo "All Scripts were executed. Stopping container..."