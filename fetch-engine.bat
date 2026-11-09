@echo off
setlocal
if not exist "vendor" mkdir "vendor"
echo Downloading PlayCanvas Engine 2.23.3 into vendor\playcanvas.mjs ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $urls=@('https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/build/playcanvas.mjs','https://unpkg.com/playcanvas@2.23.3/build/playcanvas.mjs'); foreach($url in $urls){try{Invoke-WebRequest -Uri $url -OutFile 'vendor/playcanvas.mjs' -UseBasicParsing -TimeoutSec 30; if((Get-Item 'vendor/playcanvas.mjs').Length -gt 100000){Write-Host 'Success: PlayCanvas engine self-hosted';exit 0}}catch{Write-Host ('Failed '+$url+': '+$_.Exception.Message)}};Write-Host 'Could not download PlayCanvas. Check connection or download playcanvas.mjs manually.';exit 1"
if errorlevel 1 (
 echo Please see README.md for manual steps.
 pause
 exit /b 1
)
echo Add the vendor folder to your GitHub repository and redeploy.
pause
