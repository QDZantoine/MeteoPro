<#
  Vérifie que le poste est prêt pour les TP. Aucun droit administrateur nécessaire.
  .\scripts\verifier-poste.ps1
#>
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$checks = @(
  @{ Nom = 'Node.js';  Cmd = 'node';     Args = '-v';        Requis = $true },
  @{ Nom = 'npm';      Cmd = 'npm';      Args = '-v';        Requis = $true },
  @{ Nom = 'VS Code';  Cmd = 'code';     Args = '--version'; Requis = $true },
  @{ Nom = 'curl';     Cmd = 'curl.exe'; Args = '--version'; Requis = $true },
  @{ Nom = 'Git';      Cmd = 'git';      Args = '--version'; Requis = $false }
)
$ok = $true
foreach ($c in $checks) {
  if (Get-Command $c.Cmd -ErrorAction SilentlyContinue) {
    $v = (& $c.Cmd $c.Args 2>&1 | Select-Object -First 1)
    Write-Host ("[OK]     {0,-8} {1}" -f $c.Nom, $v) -ForegroundColor Green
  } elseif ($c.Requis) {
    Write-Host ("[MANQUE] {0} (obligatoire)" -f $c.Nom) -ForegroundColor Red
    $ok = $false
  } else {
    Write-Host ("[--]     {0,-8} absent (facultatif)" -f $c.Nom) -ForegroundColor Yellow
  }
}
if (Get-Command node -ErrorAction SilentlyContinue) {
  # TypeScript exécuté nativement : Node.js 22.18 minimum, 24 LTS conseillé
  $ts = node -e "const [a,b]=process.versions.node.split('.').map(Number);console.log(a>22||(a===22&&b>=18))"
  if ($ts -ne 'true') { Write-Host '[!]      Node.js trop ancien : 22.18 minimum (24 LTS conseillé)' -ForegroundColor Red; $ok = $false }
}
if (-not (Test-Path .\node_modules)) { Write-Host '[!]      Lancez npm install dans le dossier du projet' -ForegroundColor Red; $ok = $false }
try {
  $null = Invoke-WebRequest 'https://api.open-meteo.com/v1/forecast?latitude=45.76&longitude=4.84&current=temperature_2m' -UseBasicParsing -TimeoutSec 5
  Write-Host '[OK]     Accès à api.open-meteo.com' -ForegroundColor Green
} catch {
  Write-Host '[--]     api.open-meteo.com injoignable : mettez METEO_OFFLINE=true dans .env' -ForegroundColor Yellow
}
if ($ok) { Write-Host "`nPoste prêt." -ForegroundColor Green } else { Write-Host "`nÀ compléter avant le TP 2." -ForegroundColor Red }
