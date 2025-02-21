#!/usr/bin/env bashio
script_path=$(bashio::config 'script_path')
script_argument1=$(bashio::config 'script_argument1')
script_argument2=$(bashio::config 'script_argument2')
script_argument3=$(bashio::config 'script_argument3')
script_path2=$(bashio::config 'script_path2')
script2_argument1=$(bashio::config 'script2_argument1')
script2_argument2=$(bashio::config 'script2_argument2')
script2_argument3=$(bashio::config 'script2_argument3')
script_path3=$(bashio::config 'script_path3')
script3_argument1=$(bashio::config 'script3_argument1')
script3_argument2=$(bashio::config 'script3_argument2')
script3_argument3=$(bashio::config 'script3_argument3')

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
	echo "Executing the first script $script_path with the argument $script_argument1 and the second argument $script_argument2 and the third argument $script_argument3 now..."
	echo "-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#"
	bash $script_path $script_argument1 $script_argument2 $script_argument3
fi

if [ $script_path2 != "false" ]; then
	echo "Executing the second script $script_path2 with the argument $script2_argument1 and the second argument $script2_argument2 and the third argument $script2_argument3 now..."
	echo "-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#"
	bash $script_path2 $script2_argument2 $script2_argument3
fi

if [ $script_path3 != "false" ]; then
	echo "Executing the third script $script_path3 with the argument $script3_argument1 and the second argument $script3_argument2 and the third argument $script3_argument3 now..."
	echo "-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#"
	bash $script_path3 $script3_argument1 $script3_argument2 $script3_argument3
fi

echo "-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#-#"
echo "All Scripts were executed. Stopping container..."
