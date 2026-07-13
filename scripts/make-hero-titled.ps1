# Composite the article title onto the hero image -> a self-contained cover for LinkedIn.
# Reads  docs/WhatsLeftOfUs-HeroImage.png  (2172x724)
# Writes docs/WhatsLeftOfUs-Hero-titled.jpg (title baked in, left-side scrim, JPEG q90)
#
# Run from a normal PowerShell prompt:
#   powershell -ExecutionPolicy Bypass -File scripts\make-hero-titled.ps1
#
# Uses System.Drawing (built into Windows) — no installs, fully offline.
# Text lives in the dark left third; tweak the $kicker/$line1a/$line1b/$line2/$subtitle/$byline
# variables below to change wording.

Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$docs = Join-Path (Split-Path -Parent $scriptDir) 'docs'
$in  = Join-Path $docs 'WhatsLeftOfUs-HeroImage.png'
$out = Join-Path $docs 'WhatsLeftOfUs-Hero-titled.jpg'

# ---- copy / colours ----
$kicker   = 'A FIELD REPORT'
$line1a   = "What's "       # white
$line1b   = 'left'          # amber
$line2    = 'for us?'       # white
$subtitle = 'Building software when the AI writes the code'
$byline   = 'Vivek Rawat'

$white  = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
$amber  = [System.Drawing.Color]::FromArgb(255, 200, 169, 81)   # #c8a951
$muted  = [System.Drawing.Color]::FromArgb(255, 175, 190, 205)
$navyA  = [System.Drawing.Color]::FromArgb(224, 6, 12, 22)      # scrim start (opaque-ish)
$navyB  = [System.Drawing.Color]::FromArgb(0, 6, 12, 22)        # scrim end (transparent)

$img = [System.Drawing.Image]::FromFile($in)
try {
  $W = $img.Width; $H = $img.Height
  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.DrawImage($img, 0, 0, $W, $H)

  # left-to-right dark scrim across the left ~55% for legibility
  $scrimW = [int]($W * 0.58)
  $rect = New-Object System.Drawing.Rectangle(0, 0, $scrimW, $H)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0,0)),
    (New-Object System.Drawing.Point($scrimW,0)), $navyA, $navyB)
  $g.FillRectangle($grad, $rect)

  $fmt = [System.Drawing.StringFormat]::GenericTypographic
  $x0 = [int]($W * 0.065)   # left padding

  $fKick = New-Object System.Drawing.Font('Consolas', 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fHead = New-Object System.Drawing.Font('Segoe UI', 132, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fSub  = New-Object System.Drawing.Font('Segoe UI', 40, [System.Drawing.FontStyle]::Italic, [System.Drawing.GraphicsUnit]::Pixel)
  $fBy   = New-Object System.Drawing.Font('Segoe UI', 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

  $bWhite = New-Object System.Drawing.SolidBrush($white)
  $bAmber = New-Object System.Drawing.SolidBrush($amber)
  $bMuted = New-Object System.Drawing.SolidBrush($muted)

  $y = [int]($H * 0.20)
  # kicker
  $g.DrawString($kicker, $fKick, $bAmber, [single]$x0, [single]$y, $fmt)
  $y += 52

  # headline line 1 — "What's " (white) + "left" (amber)
  $g.DrawString($line1a, $fHead, $bWhite, [single]$x0, [single]$y, $fmt)
  $wA = $g.MeasureString($line1a, $fHead, 10000, $fmt).Width
  $g.DrawString($line1b, $fHead, $bAmber, [single]($x0 + $wA), [single]$y, $fmt)
  $y += 150

  # headline line 2
  $g.DrawString($line2, $fHead, $bWhite, [single]$x0, [single]$y, $fmt)
  $y += 168

  # subtitle
  $g.DrawString($subtitle, $fSub, $bMuted, [single]$x0, [single]$y, $fmt)
  $y += 62

  # byline
  $g.DrawString($byline, $fBy, $bMuted, [single]$x0, [single]$y, $fmt)

  # save as JPEG q90
  $jpg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int]90)
  $bmp.Save($out, $jpg, $ep)
  $kb = [int]((Get-Item $out).Length / 1KB)
  Write-Output ("wrote {0}  ({1}x{2}, {3} KB)" -f (Split-Path -Leaf $out), $W, $H, $kb)
}
finally {
  if ($g)   { $g.Dispose() }
  if ($bmp) { $bmp.Dispose() }
  $img.Dispose()
}
Write-Output "done. Tip: run resize-docs-images.ps1-style shrink if you want a 1200px version."
