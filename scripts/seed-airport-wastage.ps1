# Seed Airport Terminal products + wastage (manual + POS) against live API.
param(
  [string]$BaseUrl = 'https://bisync-cloud-389272498937.asia-southeast1.run.app',
  [int]$CompanyId = 0
)

$ErrorActionPreference = 'Stop'

function Invoke-Api {
  param(
    [ValidateSet('GET','POST','PUT','PATCH','DELETE')]
    [string]$Method = 'GET',
    [Parameter(Mandatory)][string]$Path,
    [object]$Body = $null,
    [int]$CompanyIdHeader = 0
  )
  $headers = @{}
  if ($CompanyIdHeader -gt 0) {
    $headers['X-Bisync-Company-Id'] = [string]$CompanyIdHeader
  }
  $uri = "$BaseUrl$Path"
  $params = @{
    Method = $Method
    Uri = $uri
    Headers = $headers
  }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  return Invoke-RestMethod @params
}

function Get-ApiList {
  param(
    [Parameter(Mandatory)][string]$Path,
    [int]$CompanyIdHeader = 0
  )
  $result = Invoke-Api -Path $Path -CompanyIdHeader $CompanyIdHeader
  if ($null -eq $result) { return @() }
  return @($result)
}

Write-Host "API: $BaseUrl"
$companies = Get-ApiList -Path '/api/companies'
Write-Host ("Companies: " + (($companies | ForEach-Object { "$($_.id)=$($_.name)" }) -join ', '))

if ($CompanyId -le 0) {
  $qa = $companies | Where-Object { $_.name -match 'Bisync Hospitality' } | Select-Object -First 1
  if (-not $qa) { $qa = $companies | Select-Object -First 1 }
  $CompanyId = [int]$qa.id
}
Write-Host "Using companyId=$CompanyId"

$locations = Get-ApiList -Path '/api/locations' -CompanyIdHeader $CompanyId
$airport = $locations | Where-Object { $_.name -match 'Airport' -and ([int]$_.companyId -eq $CompanyId) } | Select-Object -First 1
if (-not $airport) {
  $airport = $locations | Where-Object { $_.name -match 'Airport' } | Select-Object -First 1
}
if (-not $airport) { throw 'Airport Terminal location not found.' }
if ($airport.companyId) { $CompanyId = [int]$airport.companyId }

$locId = [string]$airport.externalId
$locName = [string]$airport.name
Write-Host "Airport location: $locId ($locName) companyId=$CompanyId"

$ingredients = Get-ApiList -Path "/api/ingredients?companyId=$CompanyId" -CompanyIdHeader $CompanyId
$products = Get-ApiList -Path "/api/products?companyId=$CompanyId" -CompanyIdHeader $CompanyId
Write-Host ("Ingredients: {0}  Products: {1}" -f $ingredients.Count, $products.Count)

function Test-LocMatch($item) {
  $locs = @()
  if ($item.locationsJson) {
    try { $locs = @($item.locationsJson | ConvertFrom-Json) } catch { $locs = @() }
  }
  if ($locs.Count -eq 0 -or $locs -contains 'all') { return $true }
  return $locs -contains $locId
}

$compPool = @($ingredients | Where-Object { $_.active -ne $false -and (Test-LocMatch $_) } | Sort-Object name)
if ($compPool.Count -lt 3) { $compPool = @($ingredients | Where-Object { $_.active -ne $false } | Sort-Object name) }
if ($compPool.Count -eq 0) { throw 'No ingredients available.' }
Write-Host ("Using components: {0}, {1}, {2}" -f $compPool[0].componentId, $compPool[1].componentId, $compPool[2].componentId)

function New-RecipeItems([int]$startIndex, [int]$count = 2) {
  $items = @()
  for ($i = 0; $i -lt $count; $i++) {
    $c = $compPool[($startIndex + $i) % $compPool.Count]
    $uom = if ($c.recipeUom) { [string]$c.recipeUom } else { 'g' }
    $items += @{
      componentId = [string]$c.componentId
      componentName = [string]$c.name
      componentUom = $uom
      componentUomPrice = [decimal]$(if ($c.lastPriceRecipe) { $c.lastPriceRecipe } else { 1 })
      quantity = [decimal](1 + $i)
    }
  }
  return $items
}

function Ensure-Product {
  param(
    [string]$Name,
    [bool]$IsSubProduct = $false,
    [string]$ProductCode,
    [object[]]$Items,
    [string]$Category = 'Wastage Seed',
    [string]$Group = 'Demo'
  )
  $existing = $products | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($existing) {
    Write-Host "Exists: $Name (id=$($existing.id))"
    return $existing
  }
  $payload = @{
    productId = $ProductCode
    name = $Name
    category = $Category
    group = $Group
    isSubProduct = $IsSubProduct
    b2cEnabled = -not $IsSubProduct
    b2bEnabled = $false
    rrp = if ($IsSubProduct) { 0 } else { 18.5 }
    yieldQuantity = 1
    yieldUom = 'pcs'
    expiryPeriodDays = 3
    activationPeriodHours = 24
    parStock = 20
    parStockUom = 'pcs'
    posEnabled = -not $IsSubProduct
    active = $true
    companyId = $CompanyId
    locationExternalIds = @($locId)
    items = @($Items)
    packagingItems = @()
    aliases = @()
  }
  $created = Invoke-Api -Method POST -Path '/api/products' -Body $payload -CompanyIdHeader $CompanyId
  Write-Host "Created: $Name (id=$($created.id) code=$($created.productId) sub=$IsSubProduct)"
  $script:products = @($script:products) + @($created)
  return $created
}

$subA = Ensure-Product -Name 'WST Sauce Base' -IsSubProduct $true -ProductCode 'WST-SUB-SAUCE' -Items (New-RecipeItems 0 2) -Category 'Prep' -Group 'Sub-product'
$subB = Ensure-Product -Name 'WST Dough Ball' -IsSubProduct $true -ProductCode 'WST-SUB-DOUGH' -Items (New-RecipeItems 2 2) -Category 'Prep' -Group 'Sub-product'
$subC = Ensure-Product -Name 'WST Grill Mix' -IsSubProduct $true -ProductCode 'WST-SUB-GRILL' -Items (New-RecipeItems 4 2) -Category 'Prep' -Group 'Sub-product'

$products = Get-ApiList -Path "/api/products?companyId=$CompanyId" -CompanyIdHeader $CompanyId

$p1Items = @(New-RecipeItems 6 2) + @(
  @{
    componentId = [string]$subA.productId
    componentName = [string]$subA.name
    componentUom = if ($subA.yieldUom) { [string]$subA.yieldUom } else { 'pcs' }
    componentUomPrice = 0
    quantity = 1
  }
)

$prod1 = Ensure-Product -Name 'WST Airport Burger' -ProductCode 'WST-P-BURGER' -Items $p1Items -Category 'Hot Kitchen' -Group 'Mains'
$prod2 = Ensure-Product -Name 'WST Airport Salad' -ProductCode 'WST-P-SALAD' -Items (New-RecipeItems 8 3) -Category 'Cold Kitchen' -Group 'Mains'
$prod3 = Ensure-Product -Name 'WST Airport Latte' -ProductCode 'WST-P-LATTE' -Items (New-RecipeItems 11 2) -Category 'Beverage' -Group 'Drinks'
$prod4 = Ensure-Product -Name 'WST Airport Fries' -ProductCode 'WST-P-FRIES' -Items (New-RecipeItems 13 2) -Category 'Hot Kitchen' -Group 'Sides'
$prod5 = Ensure-Product -Name 'WST Airport Soup' -ProductCode 'WST-P-SOUP' -Items (New-RecipeItems 15 2) -Category 'Hot Kitchen' -Group 'Mains'

function Try-Produce {
  param($Product, [decimal]$Qty)
  try {
    $body = @{
      batchQty = $Qty
      locationExternalIds = @($locId)
      productionDate = (Get-Date).ToString('yyyy-MM-dd')
      overrideStock = $true
    }
    Invoke-Api -Method POST -Path "/api/product-management/$($Product.id)/produce" -Body $body -CompanyIdHeader $CompanyId | Out-Null
    Write-Host "Produced $Qty of $($Product.name)"
  } catch {
    $detail = $_.Exception.Message
    if ($_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
    Write-Host "Produce skipped for $($Product.name): $detail"
  }
}

# Only produce if stock looks empty (idempotent-ish)
foreach ($p in @($prod1, $prod2, $prod3, $prod4, $prod5)) { Try-Produce -Product $p -Qty 30 }
foreach ($s in @($subA, $subB, $subC)) { Try-Produce -Product $s -Qty 40 }

$today = (Get-Date).ToString('yyyy-MM-dd')
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$weekAgo = (Get-Date).AddDays(-7).ToString('yyyy-MM-dd')

$c0 = $compPool[0]
$c1 = $compPool[1]
$c0Uom = if ($c0.inventoryUom) { [string]$c0.inventoryUom } elseif ($c0.recipeUom) { [string]$c0.recipeUom } else { 'kg' }
$c1Uom = if ($c1.inventoryUom) { [string]$c1.inventoryUom } elseif ($c1.recipeUom) { [string]$c1.recipeUom } else { 'kg' }

# Existing wastage this month (avoid duplicate POS checks)
$month = (Get-Date).ToString('yyyy-MM')
$existing = Get-ApiList -Path "/api/wastage?companyId=$CompanyId&locationIds=$locId&month=$month" -CompanyIdHeader $CompanyId
$existingChecks = @($existing | Where-Object { $_.posCheckNo } | ForEach-Object { [string]$_.posCheckNo })
$existingKeys = @($existing | ForEach-Object { "{0}|{1}|{2}|{3}" -f $_.itemType, $_.itemKey, $_.wastedDate, $_.reason })

function Add-ManualWastage($payload) {
  $key = "{0}|{1}|{2}|{3}" -f $payload.itemType, $payload.itemKey, $payload.wastedDate, $payload.reason
  if ($existingKeys -contains $key) {
    Write-Host "Skip existing manual: $($payload.itemName) $($payload.reason)"
    return $null
  }
  $r = Invoke-Api -Method POST -Path '/api/wastage' -Body $payload -CompanyIdHeader $CompanyId
  Write-Host "Manual wastage #$($r.id): $($r.itemName) x$($r.quantity) $($r.uom) ($($r.reason))"
  return $r
}

function Add-PosWastage($payload) {
  if ($existingChecks -contains [string]$payload.checkNo) {
    Write-Host "Skip existing POS check $($payload.checkNo)"
    return $null
  }
  $r = Invoke-Api -Method POST -Path '/api/wastage/pos' -Body $payload -CompanyIdHeader $CompanyId
  Write-Host "POS wastage #$($r.id): $($r.itemName) check=$($r.posCheckNo)"
  return $r
}

$manualPayloads = @(
  @{
    companyId = $CompanyId; locationExternalId = $locId
    itemType = 'component'; itemKey = [string]$c0.componentId; itemName = [string]$c0.name
    quantity = 2; uom = $c0Uom; wastedDate = $today; reason = 'Spoilage'
  },
  @{
    companyId = $CompanyId; locationExternalId = $locId
    itemType = 'component'; itemKey = [string]$c1.componentId; itemName = [string]$c1.name
    quantity = 1.2; uom = $c1Uom; wastedDate = $yesterday; reason = 'Over-prep'
  },
  @{
    companyId = $CompanyId; locationExternalId = $locId
    itemType = 'product'; itemKey = [string]$prod2.id; itemName = [string]$prod2.name
    quantity = 2; uom = 'pcs'; wastedDate = $today; reason = 'Dropped / damaged'
  },
  @{
    companyId = $CompanyId; locationExternalId = $locId
    itemType = 'sub-product'; itemKey = [string]$subB.id; itemName = [string]$subB.name
    quantity = 3; uom = 'pcs'; wastedDate = $weekAgo; reason = 'Quality reject'
  },
  @{
    companyId = $CompanyId; locationExternalId = $locId
    itemType = 'product'; itemKey = [string]$prod5.id; itemName = [string]$prod5.name
    quantity = 1; uom = 'pcs'; wastedDate = $yesterday; reason = 'Spoilage'
  }
)

$posPayloads = @(
  @{ companyId = $CompanyId; locationExternalId = $locId; productId = [int]$prod1.id; quantity = 1; checkNo = 'CHK-AIR-1001'; reason = 'POS void'; wastedDate = $today },
  @{ companyId = $CompanyId; locationExternalId = $locId; productId = [int]$prod3.id; quantity = 2; checkNo = 'CHK-AIR-1002'; reason = 'POS refund'; wastedDate = $today },
  @{ companyId = $CompanyId; locationExternalId = $locId; productId = [int]$prod4.id; quantity = 1; checkNo = 'CHK-AIR-1003'; reason = 'POS void'; wastedDate = $yesterday }
)

$manualOk = 0; $posOk = 0
foreach ($m in $manualPayloads) {
  try {
    $r = Add-ManualWastage $m
    if ($r) { $manualOk++ }
  } catch {
    Write-Host "Manual FAILED $($m.itemName): $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  }
}
foreach ($p in $posPayloads) {
  try {
    $r = Add-PosWastage $p
    if ($r) { $posOk++ }
  } catch {
    Write-Host "POS FAILED $($p.checkNo): $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  }
}

$list = Get-ApiList -Path "/api/wastage?companyId=$CompanyId&locationIds=$locId&month=$month" -CompanyIdHeader $CompanyId
Write-Host ""
Write-Host "=== Wastage summary for $locName ($month) ==="
Write-Host ("Total rows: " + $list.Count)
foreach ($row in $list) {
  $flag = if ($row.isPos) { 'POS' } else { 'MAN' }
  Write-Host ("  [{0}] {1} {2} x{3} {4} | {5} | check={6}" -f $flag, $row.wastedDate, $row.itemName, $row.quantity, $row.uom, $row.reason, $row.posCheckNo)
}

# Stock card spot-check
Write-Host ""
Write-Host "=== Stock card spot-check (Airport) ==="
$cards = Get-ApiList -Path "/api/stock-cards?companyId=$CompanyId&locationIds=$locId&month=$month" -CompanyIdHeader $CompanyId
$wstCards = @($cards | Where-Object { $_.name -match '^WST ' -or $_.itemKey -eq $c0.componentId -or $_.itemKey -eq $c1.componentId })
Write-Host ("Matching stock cards: " + $wstCards.Count)
foreach ($sc in ($wstCards | Select-Object -First 12)) {
  Write-Host ("  [{0}] {1} out={2} onHand={3} {4}" -f $sc.itemType, $sc.name, $sc.outboundQty, $sc.onHandQty, $sc.uom)
}

# Detail for burger (POS wastage) and first component
try {
  $detail = Invoke-Api -Path "/api/stock-cards/product/$($prod1.id)?companyId=$CompanyId&locationIds=$locId&month=$month" -CompanyIdHeader $CompanyId
  $wastageLines = @($detail.entries | Where-Object { $_.entryType -match 'wastage' -or $_.reason -match 'wastage|Wastage|POS' })
  Write-Host ("Burger stock-card wastage/related lines: " + $wastageLines.Count)
  foreach ($e in ($wastageLines | Select-Object -First 5)) {
    Write-Host ("    {0} qty={1} type={2} {3}" -f $e.date, $e.quantity, $e.entryType, $e.reason)
  }
} catch {
  Write-Host "Burger stock-card detail: $($_.Exception.Message)"
}

try {
  $cdetail = Invoke-Api -Path "/api/stock-cards/component/$([uri]::EscapeDataString($c0.componentId))?companyId=$CompanyId&locationIds=$locId&month=$month" -CompanyIdHeader $CompanyId
  $wLines = @($cdetail.entries | Where-Object { $_.entryType -match 'wastage' -or $_.reason -match 'wastage|Wastage' })
  Write-Host ("Component $($c0.name) wastage lines: " + $wLines.Count)
  foreach ($e in ($wLines | Select-Object -First 5)) {
    Write-Host ("    {0} qty={1} type={2} {3}" -f $e.date, $e.quantity, $e.entryType, $e.reason)
  }
} catch {
  Write-Host "Component stock-card detail: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Done. New manual=$manualOk new POS=$posOk total=$($list.Count)"
