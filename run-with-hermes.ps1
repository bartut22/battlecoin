$ErrorActionPreference = "Stop"

$hermes = Join-Path $env:LOCALAPPDATA "hermes\bin\hermes.cmd"
if (-not (Test-Path -LiteralPath $hermes)) {
    throw "Hermes was not found at $hermes"
}

& $hermes --in $PSScriptRoot
