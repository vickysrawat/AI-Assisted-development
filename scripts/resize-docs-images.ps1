# Resize the article hero/section images to LinkedIn-friendly copies.
# Produces docs/<name>-linkedin.jpg — ~1200px wide, JPEG q85 (typically 100-300 KB each).
# Originals (2172x724 PNG) are left untouched.
#
# Run from the repo root (or anywhere) in a normal PowerShell prompt:
#   powershell -ExecutionPolicy Bypass -File scripts\resize-docs-images.ps1
#
# Uses System.Drawing (built into Windows) — no installs, fully offline.

Add-Type -AssemblyName System.Drawing

$targetW = 1200      # target width in px (height scales to keep 3:1)
$quality = 85        # JPEG quality 0-100

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$docs = Join-Path (Split-Path -Parent $scriptDir) 'docs'

$files = @(
  'WhatsLeftOfUs-HeroImage.png',
  'NavigatingTheDitialGrid.png',
  'FingerprintScan.png',
  'Team.png'
)

$jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [int]$quality)

foreach ($f in $files) {
  $in = Join-Path $docs $f
  if (-not (Test-Path $in)) { Write-Warning "skip (not found): $f"; continue }

  $img = [System.Drawing.Image]::FromFile($in)
  try {
    $w = $targetW
    $h = [int][Math]::Round($img.Height * ($targetW / $img.Width))
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)

    $out = Join-Path $docs (([System.IO.Path]::GetFileNameWithoutExtension($f)) + '-linkedin.jpg')
    $bmp.Save($out, $jpgCodec, $ep)
    $kb = [int]((Get-Item $out).Length / 1KB)
    Write-Output ("wrote {0}  ({1}x{2}, {3} KB)" -f (Split-Path -Leaf $out), $w, $h, $kb)
  }
  finally {
    if ($g)   { $g.Dispose() }
    if ($bmp) { $bmp.Dispose() }
    $img.Dispose()
  }
}
Write-Output "done."
