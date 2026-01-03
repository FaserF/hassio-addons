#!/usr/bin/env bashio

# Enable strict mode
set -euo pipefail
# shellcheck disable=SC1091



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

if [ "$script_path" != "false" ]; then
	if [ ! -f "$script_path" ]; then
		bashio::log.error "Cannot find your first script at $script_path"
		bashio::log.error "Exiting now..."
		exit 1
	fi
fi

if [ "$script_path2" != "false" ]; then
	if [ ! -f "$script_path2" ]; then
		bashio::log.error "Cannot find your second script at $script_path2"
		bashio::log.error "Exiting now..."
		exit 1
	fi
fi

if [ "$script_path3" != "false" ]; then
	if [ ! -f "$script_path3" ]; then
		bashio::log.error "Cannot find your third script at $script_path3"
		bashio::log.error "Exiting now..."
		exit 1
	fi
fi

#Set 711 rights to script
bashio::log.info "Fixing permissions."
if [ "$script_path" != "false" ]; then
	chmod 711 "$script_path"
fi
if [ "$script_path2" != "false" ]; then
	chmod 711 "$script_path2"
fi
if [ "$script_path3" != "false" ]; then
	chmod 711 "$script_path3"
fi

# Function to execute script with filtered arguments
execute_script() {
	local path="$1"
	local arg1="$2"
	local arg2="$3"
	local arg3="$4"
	local num="$5"

	local args=()
	[ "$arg1" != "false" ] && args+=("$arg1")
	[ "$arg2" != "false" ] && args+=("$arg2")
	[ "$arg3" != "false" ] && args+=("$arg3")

	bashio::log.info "Executing script #$num: $path with ${#args[@]} arguments..."
	bashio::log.info "-----------------------------------------------------------"
	bash "$path" "${args[@]}"
}

if [ "$script_path" != "false" ]; then
	execute_script "$script_path" "$script_argument1" "$script_argument2" "$script_argument3" "1"
fi

if [ "$script_path2" != "false" ]; then
	execute_script "$script_path2" "$script2_argument1" "$script2_argument2" "$script2_argument3" "2"
fi

if [ "$script_path3" != "false" ]; then
	execute_script "$script_path3" "$script3_argument1" "$script3_argument2" "$script3_argument3" "3"
fi

bashio::log.info "-----------------------------------------------------------"
bashio::log.info "All Scripts were executed. Stopping container..."
