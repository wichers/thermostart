@echo off
cd services/web
pyinstaller --onefile -c ^
--add-data "firmware;firmware" ^
--runtime-hook thermostart_hook.py ^
--distpath ../../dist ^
--workpath ../../build ^
--icon=thermostart/static/images/thermostart.ico ^
-F thermostart/ts/utils.py
cd ../../