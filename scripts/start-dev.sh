#!/bin/bash
# WSL2のIPを取得してWindowsポートフォワーディングを更新し、Metroを起動する

set -e

WSL_IP=$(hostname -I | awk '{print $1}')
echo "WSL2 IP: $WSL_IP"

# 一時PS1ファイルを作成
PS_FILE=$(mktemp --suffix=.ps1)
cat > "$PS_FILE" << PSEOF
\$ErrorActionPreference = 'SilentlyContinue'
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=8082 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=3001 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$WSL_IP
netsh interface portproxy add v4tov4 listenport=8082 listenaddress=0.0.0.0 connectport=8082 connectaddress=$WSL_IP
netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=$WSL_IP
netsh advfirewall firewall delete rule name="Metro RN Dev"
netsh advfirewall firewall add rule name="Metro RN Dev" dir=in action=allow protocol=TCP localport=8081-8082
netsh advfirewall firewall delete rule name="AIMORPHO API"
netsh advfirewall firewall add rule name="AIMORPHO API" dir=in action=allow protocol=TCP localport=3001
Write-Host "Port forwarding updated: Windows -> $WSL_IP:8081"
PSEOF

WIN_PS=$(wslpath -w "$PS_FILE")

echo "ポートフォワーディングを更新中... (UACダイアログが出たら許可してください)"
powershell.exe -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-ExecutionPolicy Bypass -NoProfile -File $WIN_PS'"

rm -f "$PS_FILE"

# Windows側のWiFi IPを表示
WIN_IP=$(powershell.exe -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -match 'Wi-Fi|WiFi|Wireless|WLAN' } | Select-Object -First 1).IPAddress" 2>/dev/null | tr -d '\r\n')
if [ -n "$WIN_IP" ]; then
  echo ""
  echo "デバイス接続先: $WIN_IP:8081"
  echo "  → Androidデバイスをシェイク → Dev Settings → Debug server host → $WIN_IP:8081"
fi

echo ""
echo "Metro起動中..."
cd "$(dirname "$0")/../mobile"
npx react-native start --reset-cache
