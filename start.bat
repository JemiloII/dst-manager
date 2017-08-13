SET root_dir=%CD%
SET steamcmd_dir=%root_dir%\steamcmd
SET install_dir=%root_dir%\dontstarvetogether
SET cluster_name=MyServer

%steamcmd_dir%\steamcmd.exe +force_install_dir %install_dir% +login anonymous +app_update 343050 validate +quit
cd /D "%install_dir%\bin"
start dontstarve_dedicated_server_nullrenderer -console -conf_dir "servers" -persistent_storage_root "%root_dir%" -cluster MyServer -shard Master
start dontstarve_dedicated_server_nullrenderer -console -conf_dir "servers" -persistent_storage_root "%root_dir%" -cluster MyServer -shard Caves