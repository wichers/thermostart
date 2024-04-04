@echo off
cd services/web
pyinstaller --onefile -w ^
--hidden-import=eventlet.hubs.epolls ^
--hidden-import=eventlet.hubs.kqueue ^
--hidden-import=eventlet.hubs.selects ^
--hidden-import=dns.rdtypes.ANY ^
--hidden-import=dns.rdtypes.IN ^
--hidden-import=dns.rdtypes.CH ^
--hidden-import=dns.rdtypes.dnskeybase ^
--hidden-import=dns.asyncbackend ^
--hidden-import=dns.dnssec ^
--hidden-import=dns.e164 ^
--hidden-import=dns.namedict ^
--hidden-import=dns.tsigkeyring ^
--hidden-import=dns.versioned ^
--add-data "thermostart/static;thermostart/static" ^
--add-data "thermostart/templates;thermostart/templates" ^
--add-data "firmware;firmware" ^
--add-data "world_cities_location_table.csv;." ^
--runtime-hook thermostart_hook.py ^
--distpath ../../dist ^
--workpath ../../build ^
--icon=thermostart/static/images/thermostart.ico ^
-F thermostart.py
cd ../../