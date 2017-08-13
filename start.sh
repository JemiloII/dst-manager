#!/bin/bash

root_dir=$PWD
steamcmd_dir="$root_dir/steamcmd"
install_dir="$root_dir/dontstarvetogether"
cluster_name="MyServer"
dontstarve_dir="$root_dir/servers"

function fail() {
    echo Error: "$@" >&2
    exit 1
}

function check_for_file() {
    if [ ! -e "$1" ]; then
            fail "Missing file: $1"
    fi
}

cd "$steamcmd_dir" || fail "Missing $steamcmd_dir directory!"

check_for_file "steamcmd.sh"
check_for_file "$dontstarve_dir/$cluster_name/cluster.ini"
check_for_file "$dontstarve_dir/$cluster_name/cluster_token.txt"
check_for_file "$dontstarve_dir/$cluster_name/Master/server.ini"
check_for_file "$dontstarve_dir/$cluster_name/Caves/server.ini"

./steamcmd.sh +force_install_dir "$install_dir" +login anonymous +app_update 343050 validate +quit

check_for_file "$install_dir/dontstarve_dedicated_server_nullrenderer.app/Contents/MacOS/"

cd "$install_dir/dontstarve_dedicated_server_nullrenderer.app/Contents/MacOS/" || fail

run_shared=(./dontstarve_dedicated_server_nullrenderer)
run_shared+=(-console)
run_shared+=(-cluster "$cluster_name")
run_shared+=(-conf_dir "servers")
run_shared+=(-persistent_storage_root "$root_dir")
run_shared+=(-monitor_parent_process $$)

"${run_shared[@]}" -shard Caves  | sed 's/^/Caves:  /' &
"${run_shared[@]}" -shard Master | sed 's/^/Master: /'
