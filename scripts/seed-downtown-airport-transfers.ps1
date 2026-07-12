$ErrorActionPreference = 'Stop'
$Base = 'http://127.0.0.1:5299'
$CompanyId = 1
$today = (Get-Date).ToString('yyyy-MM-dd')
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')

function Invoke-Api {
  param([string]$Method, [string]$Path, $Body = $null)
  $headers = @{ 'X-Bisync-Company-Id' = '1' }
  $uri = "$Base$Path"
  Write-Host (">> $Method $uri")
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 20 -Compress
    $result = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType 'application/json' -Body $json
  } else {
    $result = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }
  return ,$result
}

function Get-ApiList {
  param([string]$Path)
  $raw = Invoke-Api -Method GET -Path $Path
  if ($null -eq $raw) { return @() }
  if ($raw -is [System.Array]) { return $raw }
  return @($raw)
}

Write-Host 'Health...'
Write-Host ((Invoke-RestMethod -Uri "$Base/api/health").status)

$products = Get-ApiList -Path "/api/products?companyId=$CompanyId"
Write-Host ("Products loaded: " + $products.Count)

$sauce = $null
$b2b = $null
foreach ($p in $products) {
  if ($p.name -eq 'WST Sauce Base') { $sauce = $p }
  if ($p.name -eq 'XFR B2B Meal Box') { $b2b = $p }
  if (-not $b2b -and -not $p.isSubProduct -and $p.b2bEnabled -and $p.active -ne $false -and $p.name -notmatch 'Save Test|Unique|SC Demo') {
    $b2b = $p
  }
}
if (-not $sauce) { throw 'WST Sauce Base not found — create sub-products first.' }

if (-not $b2b -or $b2b.name -ne 'XFR B2B Meal Box') {
  $existingXfr = $null
  foreach ($p in $products) { if ($p.name -eq 'XFR B2B Meal Box') { $existingXfr = $p } }
  if ($existingXfr) {
    $b2b = $existingXfr
  } else {
    $b2b = Invoke-Api -Method POST -Path '/api/products' -Body @{
      productId = 'XFR-B2B-BOX'
      name = 'XFR B2B Meal Box'
      category = 'Hot Kitchen'
      group = 'Mains'
      isSubProduct = $false
      b2cEnabled = $false
      b2bEnabled = $true
      rrp = 22
      yieldQuantity = 1
      yieldUom = 'pcs'
      expiryPeriodDays = 3
      activationPeriodHours = 24
      parStock = 20
      parStockUom = 'pcs'
      posEnabled = $false
      active = $true
      companyId = $CompanyId
      locationExternalIds = @('downtown', 'airport')
      items = @(
        @{
          componentId = 'CMP-00FLOU-001'
          componentName = '00 Flour'
          componentUom = 'g'
          componentUomPrice = 0.002
          quantity = 50
        }
      )
      packagingItems = @()
      aliases = @()
    }
    Write-Host "Created $($b2b.name) id=$($b2b.id)"
  }
}
Write-Host ("Using B2B product $($b2b.name) id=$($b2b.id); sauce id=$($sauce.id)")

foreach ($pair in @(
  @{ p = $b2b; loc = 'downtown'; qty = 40 },
  @{ p = $b2b; loc = 'airport'; qty = 15 },
  @{ p = $sauce; loc = 'downtown'; qty = 25 },
  @{ p = $sauce; loc = 'airport'; qty = 20 }
)) {
  try {
    Invoke-Api -Method POST -Path "/api/product-management/$($pair.p.id)/produce" -Body @{
      batchQty = $pair.qty
      locationExternalIds = @($pair.loc)
      productionDate = $today
      overrideStock = $true
    } | Out-Null
    Write-Host "Produced $($pair.qty) $($pair.p.name) @ $($pair.loc)"
  } catch {
    Write-Host "Produce note $($pair.p.name)@$($pair.loc): $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  }
}

$flourKey = 'CMP-00FLOU-001'
try {
  $avail = Invoke-Api -Method GET -Path "/api/transfers/available?companyId=1&itemType=component&itemKey=$flourKey&locationExternalId=downtown&uom=kg"
  Write-Host "Flour downtown available=$($avail.availableQty) $($avail.uom)"
  if ([decimal]$avail.availableQty -lt 5) {
    Invoke-Api -Method POST -Path "/api/stock-cards/component/$flourKey/adjustments" -Body @{
      companyId = 1
      locationIds = 'downtown'
      locationExternalId = 'downtown'
      uomMode = 'inventory'
      adjustmentDate = $today
      quantity = 10
      direction = 'in'
      reason = 'Transfer seed stock'
      inboundUom = 'kg'
      inboundUnitPrice = 5
    } | Out-Null
    Write-Host 'Added 10kg flour at downtown'
  }
} catch {
  Write-Host "Flour adjust: $($_.Exception.Message)"
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}

$existing = Get-ApiList -Path "/api/transfers?companyId=1&locationIds=downtown,airport&month=$((Get-Date).ToString('yyyy-MM'))"
$existingKeys = @($existing | ForEach-Object {
  "{0}|{1}|{2}|{3}|{4}" -f $_.itemKey, $_.fromLocationExternalId, $_.toLocationExternalId, $_.transferDate, $_.quantity
})

$transfers = @(
  @{
    companyId = 1; fromLocationExternalId = 'downtown'; toLocationExternalId = 'airport'
    itemType = 'component'; itemKey = $flourKey; itemName = '00 Flour'
    quantity = 2; uom = 'kg'; transferDate = $today
  },
  @{
    companyId = 1; fromLocationExternalId = 'airport'; toLocationExternalId = 'downtown'
    itemType = 'sub-product'; itemKey = [string]$sauce.id; itemName = $sauce.name
    quantity = 5; uom = 'pcs'; transferDate = $today
  },
  @{
    companyId = 1; fromLocationExternalId = 'downtown'; toLocationExternalId = 'airport'
    itemType = 'product'; itemKey = [string]$b2b.id; itemName = $b2b.name
    quantity = 8; uom = 'pcs'; transferDate = $yesterday
  },
  @{
    companyId = 1; fromLocationExternalId = 'airport'; toLocationExternalId = 'downtown'
    itemType = 'product'; itemKey = [string]$b2b.id; itemName = $b2b.name
    quantity = 3; uom = 'pcs'; transferDate = $today
  }
)

foreach ($t in $transfers) {
  $key = "{0}|{1}|{2}|{3}|{4}" -f $t.itemKey, $t.fromLocationExternalId, $t.toLocationExternalId, $t.transferDate, $t.quantity
  if ($existingKeys -contains $key) {
    Write-Host "Skip existing $($t.itemName) $($t.fromLocationExternalId)->$($t.toLocationExternalId)"
    continue
  }
  try {
    $r = Invoke-Api -Method POST -Path '/api/transfers' -Body $t
    Write-Host ("Transfer #$($r.id): $($r.itemName) $($r.quantity) $($r.uom) $($r.fromLocationExternalId)->$($r.toLocationExternalId)")
  } catch {
    Write-Host "Transfer FAILED $($t.itemName): $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  }
}

$month = (Get-Date).ToString('yyyy-MM')
$list = Get-ApiList -Path "/api/transfers?companyId=1&locationIds=downtown,airport&month=$month"
Write-Host ("History rows: " + $list.Count)
foreach ($row in $list) {
  Write-Host ("  $($row.transferDate) $($row.itemName) x$($row.quantity) $($row.fromLocationExternalId)->$($row.toLocationExternalId)")
}

Write-Host '--- Stock cards ---'
foreach ($check in @(
  @{ type='component'; key=$flourKey; loc='downtown' },
  @{ type='component'; key=$flourKey; loc='airport' },
  @{ type='product'; key=[string]$b2b.id; loc='downtown' },
  @{ type='product'; key=[string]$b2b.id; loc='airport' },
  @{ type='sub-product'; key=[string]$sauce.id; loc='downtown' },
  @{ type='sub-product'; key=[string]$sauce.id; loc='airport' }
)) {
  try {
    $path = "/api/stock-cards/$($check.type)/$([uri]::EscapeDataString($check.key))?companyId=1&locationIds=$($check.loc)&month=$month"
    $sc = Invoke-Api -Method GET -Path $path
    $xfer = @($sc.entries | Where-Object { $_.entryType -match 'transfer' })
    Write-Host ("  $($check.type) @$($check.loc) onHand=$($sc.onHandQty) out=$($sc.outboundQty) in=$($sc.inboundQty) xferLines=$($xfer.Count)")
  } catch {
    Write-Host ("  $($check.type) @$($check.loc) ERR $($_.Exception.Message)")
  }
}
