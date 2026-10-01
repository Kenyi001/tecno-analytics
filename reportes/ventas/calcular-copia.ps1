$ErrorActionPreference = "Stop"
$ruta = Join-Path $env:TEMP "tecno-calculo.xlsx"
if ($ruta -match "Ciclo 9|21_09_20_10") {
  throw "La copia temporal apunta al libro abierto."
}
if (Test-Path $ruta) { Remove-Item $ruta -Force }

$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $raiz
try {
  node reportes/ventas/calcular-copia.mjs bajar $ruta
  if ($LASTEXITCODE -ne 0) { throw "No se pudo bajar el Excel del día." }
  Unblock-File -Path $ruta
  $antesHuella = (node reportes/ventas/calcular-copia.mjs huella $ruta).Trim()

  $antes = @(Get-Process excel -ErrorAction SilentlyContinue | ForEach-Object Id)
  $excel = New-Object -ComObject Excel.Application
  Start-Sleep -Seconds 2
  $despues = @(Get-Process excel -ErrorAction SilentlyContinue | ForEach-Object Id)
  $librosAntes = 0
  try { $librosAntes = [int]$excel.Workbooks.Count } catch { }
  $instanciaNueva = @($despues | Where-Object { $antes -notcontains $_ }).Count -gt 0 -and $librosAntes -eq 0
  if ($instanciaNueva) { Write-Output "Excel nuevo para la copia." } else { Write-Output "Excel ya estaba abierto; no se cierra." }

  $alertas = $excel.DisplayAlerts
  $preguntar = $excel.AskToUpdateLinks
  $libro = $null
  try {
    if ($instanciaNueva) { $excel.Visible = $false }
    $excel.DisplayAlerts = $false
    $excel.AskToUpdateLinks = $false
    $libro = $excel.Workbooks.Open($ruta)
    if ($libro.FullName -notlike "*tecno-calculo.xlsx") {
      throw "Excel abrió un libro distinto de la copia."
    }
    try { $excel.CalculateFullRebuild() } catch { $excel.Calculate() }
    try { $libro.RefreshAll() } catch { }
    try { $excel.CalculateFullRebuild() } catch { $excel.Calculate() }
    try { $excel.CalculateUntilAsyncQueriesDone() } catch { }
    Start-Sleep -Seconds 2
    $libro.Save()
    $libro.Close($true)
    $libro = $null
  } finally {
    if ($libro) {
      try { $libro.Close($false) } catch { }
      $libro = $null
    }
    if ($instanciaNueva) {
      try { $excel.Quit() } catch { }
    } else {
      try { $excel.DisplayAlerts = $alertas } catch { }
      try { $excel.AskToUpdateLinks = $preguntar } catch { }
    }
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }

  $despuesHuella = (node reportes/ventas/calcular-copia.mjs huella $ruta).Trim()
  if ($antesHuella -and $despuesHuella -and $antesHuella -ne $despuesHuella) {
    Write-Output "La huella de los gráficos cambió."
  } else {
    Write-Output "La huella de los gráficos no cambió."
  }
  node reportes/ventas/calcular-copia.mjs subir $ruta
  if ($LASTEXITCODE -ne 0) { throw "No se pudo subir la copia calculada." }
} finally {
  Pop-Location
  if (Test-Path $ruta) { Remove-Item $ruta -Force }
}
