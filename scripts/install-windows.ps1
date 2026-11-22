<#
  Prépare une VM Windows 10 ou 11 pour la formation REST API : bonnes pratiques et sécurité.
  PowerShell ouvert en tant qu'administrateur, depuis le dossier du projet :
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    .\scripts\install-windows.ps1           # 4 outils : Node.js, VS Code, Git, Insomnia
    .\scripts\install-windows.ps1 -Zap      # ajoute OWASP ZAP (scan automatisé, facultatif)
#>
param([switch]$Zap)

$ErrorActionPreference = 'Stop'
$debut = Get-Date

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Warning 'Relancez PowerShell en tant qu''administrateur.'
  exit 1
}
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Warning 'winget est absent : installez « App Installer » depuis le Microsoft Store, ou suivez l''installation manuelle du cahier de TP.'
  exit 1
}

$packages = @(
  @{ Id = 'OpenJS.NodeJS.LTS';          Nom = 'Node.js LTS' },
  @{ Id = 'Microsoft.VisualStudioCode'; Nom = 'Visual Studio Code' },
  @{ Id = 'Git.Git';                    Nom = 'Git' },
  @{ Id = 'Insomnia.Insomnia';          Nom = 'Insomnia' }
)
if ($Zap) {
  $packages += @{ Id = 'EclipseAdoptium.Temurin.21.JRE'; Nom = 'Java 21 (requis par ZAP)' }
  $packages += @{ Id = 'ZAP.ZAP'; Nom = 'OWASP ZAP' }
}

foreach ($p in $packages) {
  Write-Host "==> $($p.Nom)" -ForegroundColor Cyan
  winget install --id $p.Id --exact --silent --disable-interactivity --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { Write-Warning "$($p.Nom) : code $LASTEXITCODE (déjà installé ou échec, voir ci-dessus)" }
}

# PATH rafraîchi : node, npm et code utilisables tout de suite
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

# npm est lancé via npm.ps1 : PowerShell doit autoriser les scripts locaux pour l'utilisateur
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

# Dépendances du projet (une seule commande, 3 paquets directs)
if (Test-Path .\package.json) {
  Write-Host '==> Dépendances du projet (npm install)' -ForegroundColor Cyan
  npm install --no-audit --no-fund
}

Write-Host '==> Extension VS Code OpenAPI' -ForegroundColor Cyan
code --install-extension 42Crunch.vscode-openapi --force

$duree = [int]((Get-Date) - $debut).TotalMinutes
Write-Host ''
Write-Host "Installation terminée en $duree min. Lancez .\scripts\verifier-poste.ps1" -ForegroundColor Green
