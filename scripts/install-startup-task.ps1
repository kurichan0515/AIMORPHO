# Windows起動時にWSL2ポートフォワーディングを自動更新するタスクを登録する
# PowerShell管理者権限で一回だけ実行する

$taskName = "WSL2 Metro Port Forward"

$script = @'
$ErrorActionPreference = 'SilentlyContinue'
Start-Sleep -Seconds 5
$ip = (wsl hostname -I 2>$null).Trim().Split()[0]
if (-not $ip) { exit 1 }

netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=8082 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$ip
netsh interface portproxy add v4tov4 listenport=8082 listenaddress=0.0.0.0 connectport=8082 connectaddress=$ip
netsh advfirewall firewall delete rule name="Metro RN Dev"
netsh advfirewall firewall add rule name="Metro RN Dev" dir=in action=allow protocol=TCP localport=8081-8082
'@

# スクリプトをWindowsのAppDataに保存
$scriptDir  = "$env:APPDATA\WSL2DevTools"
$scriptPath = "$scriptDir\update-portfwd.ps1"
New-Item -ItemType Directory -Force -Path $scriptDir | Out-Null
$script | Set-Content -Path $scriptPath -Encoding UTF8

# タスクスケジューラに登録（ログイン時に管理者権限で実行）
$action    = New-ScheduledTaskAction -Execute "powershell.exe" `
               -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger   = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
               -StartWhenAvailable -MultipleInstances IgnoreNew

# 既存タスクを上書き登録
Register-ScheduledTask -TaskName $taskName `
  -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings `
  -Force | Out-Null

Write-Host "タスク登録完了: '$taskName'"
Write-Host "次回Windowsログイン時から自動でポートフォワーディングが設定されます。"
Write-Host ""
Write-Host "今すぐ適用するには:"
Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
