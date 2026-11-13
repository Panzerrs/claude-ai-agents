# Updates ofis/durum.json so the office panel shows who is doing what.
# Usage:
#   durum.ps1 -Ajan backend -Durum calisiyor -Gorev "API taslagi"
#   durum.ps1 -Ajan backend -Durum bitti -Gorev "API taslagi hazir"
#   durum.ps1 -Ajan backend -Durum bosta
#   durum.ps1 -Ajan pazar -Kime urun -Gorev "pazar ozeti"     (handoff: pazar -> urun)
#   durum.ps1 -Sifirla
param(
  [string]$Ajan,
  [ValidateSet('bosta', 'calisiyor', 'bitti')][string]$Durum = 'bosta',
  [string]$Gorev = '',
  [string]$Kime = '',
  [switch]$Sifirla
)

$ErrorActionPreference = 'Stop'
$dosya = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'durum.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Yaz($nesne) {
  $json = ConvertTo-Json -InputObject $nesne -Depth 6
  for ($i = 0; $i -lt 5; $i++) {
    try { [System.IO.File]::WriteAllText($dosya, $json, $utf8); return }
    catch { Start-Sleep -Milliseconds 120 }
  }
  throw "durum.json yazilamadi"
}

$d = $null
if (Test-Path -LiteralPath $dosya) {
  try { $d = [System.IO.File]::ReadAllText($dosya, $utf8) | ConvertFrom-Json } catch { $d = $null }
}

# The handoff counter survives a reset so the panel never sees a number twice.
$aktarimNo = 0
if ($d -and ($d.PSObject.Properties.Name -contains 'aktarimNo')) { $aktarimNo = [int]$d.aktarimNo }

if ($Sifirla) {
  Yaz ([pscustomobject]@{ ajanlar = [pscustomobject]@{}; kayit = @(); aktarimNo = $aktarimNo })
  "Ofis sifirlandi."
  exit 0
}

if (-not $Ajan) { throw "-Ajan gerekli (kadro.json icindeki id)." }

if (-not $d) { $d = [pscustomobject]@{ ajanlar = [pscustomobject]@{}; kayit = @(); aktarimNo = 0 } }
if (-not $d.ajanlar) { $d | Add-Member -NotePropertyName ajanlar -NotePropertyValue ([pscustomobject]@{}) -Force }

$simdi = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
$liste = New-Object System.Collections.ArrayList
foreach ($k in @($d.kayit)) { if ($k) { [void]$liste.Add($k) } }

if ($Kime) {
  # Handoff: one agent's result is passed to another. Statuses do not change.
  $aktarimNo++
  [void]$liste.Add([pscustomobject]@{ zaman = $simdi; ajan = $Ajan; durum = 'aktarim'; kime = $Kime; gorev = $Gorev; no = $aktarimNo })
  $sonuc = "$Ajan -> $Kime (aktarim $aktarimNo)"
}
else {
  $kayitGorev = $Gorev
  if ($Durum -eq 'bosta') { $Gorev = '' }
  $d.ajanlar | Add-Member -NotePropertyName $Ajan -NotePropertyValue ([pscustomobject]@{
      durum = $Durum; gorev = $Gorev; zaman = $simdi
    }) -Force
  [void]$liste.Add([pscustomobject]@{ zaman = $simdi; ajan = $Ajan; durum = $Durum; gorev = $kayitGorev })
  $sonuc = "$Ajan -> $Durum"
}

while ($liste.Count -gt 40) { $liste.RemoveAt(0) }
$d | Add-Member -NotePropertyName kayit -NotePropertyValue ($liste.ToArray()) -Force
$d | Add-Member -NotePropertyName aktarimNo -NotePropertyValue $aktarimNo -Force

Yaz $d
$sonuc
