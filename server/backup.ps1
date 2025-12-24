# SQLite Database Backup Script
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupDir = ".\backups"
$dbFile = ".\prisma\production.db"
$backupFile = "$backupDir\production_$timestamp.db"

# Create backup directory if it doesn't exist
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# Copy database file
Copy-Item $dbFile $backupFile
Write-Host "✅ Backup created: $backupFile"

# Keep only last 10 backups
$backups = Get-ChildItem $backupDir -Filter "production_*.db" | Sort-Object LastWriteTime -Descending
if ($backups.Count -gt 10) {
    $backups | Select-Object -Skip 10 | Remove-Item
    Write-Host "🗑️ Old backups cleaned up"
}
