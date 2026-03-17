Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw 'Not inside a Git repository.'
}

Set-Location $repoRoot

$requiredRemotes = @('github', 'gitlab')
foreach ($remote in $requiredRemotes) {
  git remote get-url $remote *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Missing required remote '$remote'. Add it first, then re-run this script."
  }
}

git config core.hooksPath .githooks

Write-Host 'Configured core.hooksPath to .githooks'
Write-Host 'Push mirroring is now active: a normal git push will mirror the current branch to github and gitlab.'
