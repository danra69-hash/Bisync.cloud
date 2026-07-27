/**
 * One-off connectivity probe for web mobile API modules (read-only calls).
 * Usage: node scripts/check-api-connectivity.mjs
 */
const PROXY = 'http://localhost:5174'
const CLIENT_ID = 'rms'
const CLIENT_SECRET = 'DN3MOQKB6Z0QGB6KX069'

const ACCOUNTS = [
  { label: 'Operator', username: 'ms@cubevalue.com', password: '12345678' },
  { label: 'Vendor', username: 'vendor@cubevalue.com', password: '1234' },
]

function okEnvelope(json) {
  if (json == null || typeof json !== 'object') return true
  const success = json.success ?? json.Success ?? json.isSuccess ?? json.IsSuccess
  if (success === false) {
    return (
      json.errorMessage ||
      json.ErrorMessage ||
      json.message ||
      json.Message ||
      'API success=false'
    )
  }
  return true
}

async function tokenLogin(username, password) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'password',
    username,
    password,
    client_secret: CLIENT_SECRET,
  })
  const res = await fetch(`${PROXY}/identity/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof json === 'string' ? json.slice(0, 120) : json?.error_description || json?.error || res.statusText}`)
  }
  if (!json?.access_token) throw new Error('No access_token')
  return json.access_token
}

async function apiCall(token, path, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${token}` }
  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`${PROXY}/mobile-api/${path.replace(/^\//, '')}`, {
    method: body !== undefined ? method : method,
    headers,
    body: payload,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (!res.ok) {
    const msg =
      typeof json === 'string'
        ? json.slice(0, 160)
        : json?.errorMessage ||
          json?.ErrorMessage ||
          json?.message ||
          json?.Message ||
          res.statusText
    throw new Error(`HTTP ${res.status}: ${msg}`)
  }
  const envCheck = okEnvelope(json)
  if (envCheck !== true) throw new Error(String(envCheck))
  return json
}

function entity(json) {
  if (!json || typeof json !== 'object') return json
  return json.entity ?? json.Entity ?? json.data ?? json.Data ?? json
}

async function runCheck(label, fn) {
  try {
    const detail = await fn()
    return { label, status: 'ok', detail }
  } catch (err) {
    return { label, status: 'fail', detail: err?.message || String(err) }
  }
}

async function probeOperator(token) {
  const results = []
  let outletId = 924
  let toOutletId = null
  let orderId = null
  let transferId = null
  let wastageId = null
  let inventoryId = null
  let ingredientId = null

  results.push(
    await runCheck('Account/Detail', async () => {
      const j = await apiCall(token, 'Account/Detail')
      const e = entity(j)
      return `${e?.userType || '?'} / ${e?.username || '?'}`
    }),
  )

  results.push(
    await runCheck('OperatorOrder/Outlet', async () => {
      const j = await apiCall(token, 'OperatorOrder/Outlet')
      const list = entity(j)
      const outlets = Array.isArray(list) ? list : []
      const def = outlets.find((o) => o.isDefault) || outlets[0]
      if (def?.outletId) outletId = def.outletId
      return `${outlets.length} outlets (using ${outletId})`
    }),
  )

  results.push(
    await runCheck('OperatorOrder/List', async () => {
      const j = await apiCall(token, 'OperatorOrder/List', {
        method: 'POST',
        body: {
          pageSize: 5,
          pageIndex: 1,
          purchaseOrderNumber: '',
          status: ['Requested', 'Approved', 'Received'],
        },
      })
      const list = entity(j)
      const orders = Array.isArray(list) ? list : []
      if (orders[0]?.id) orderId = orders[0].id
      return `${orders.length} orders${orderId ? ` (sample ${orderId})` : ''}`
    }),
  )

  if (orderId) {
    results.push(
      await runCheck(`Operatororder/${orderId}`, async () => {
        await apiCall(token, `Operatororder/${orderId}`)
        return 'detail loaded'
      }),
    )
    results.push(
      await runCheck(`OperatorOrder/CopyPO/${orderId}`, async () => {
        const j = await apiCall(token, `OperatorOrder/CopyPO/${orderId}`)
        const e = entity(j)
        const link = typeof e === 'string' ? e : e?.url || e?.link || JSON.stringify(e).slice(0, 80)
        return link || 'empty'
      }),
    )
  }

  results.push(
    await runCheck('OperatorOrder/Ingredient/Category', async () => {
      const j = await apiCall(token, 'OperatorOrder/Ingredient/Category')
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} categories`
    }),
  )

  results.push(
    await runCheck('OperatorOrder/Ingredient', async () => {
      const j = await apiCall(token, 'OperatorOrder/Ingredient', {
        method: 'POST',
        body: {
          pageSize: 10,
          pageIndex: 1,
          outletId,
          vendorId: null,
          categoryId: null,
          groupId: null,
          keyword: '',
        },
      })
      const list = entity(j)
      const rows = Array.isArray(list) ? list : []
      if (rows[0]?.ingredientId) ingredientId = rows[0].ingredientId
      return `${rows.length} ingredients`
    }),
  )

  results.push(
    await runCheck(`OperatorOrder/Vendors/${outletId}`, async () => {
      const j = await apiCall(token, `OperatorOrder/Vendors/${outletId}`)
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} vendors`
    }),
  )

  results.push(
    await runCheck(`OperatorOrder/Cart?outletId=${outletId}`, async () => {
      const j = await apiCall(token, `OperatorOrder/Cart?outletId=${outletId}`)
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} cart vendors`
    }),
  )

  results.push(
    await runCheck(`OperatorOrder/OrderTemplate?outletId=${outletId}`, async () => {
      const j = await apiCall(token, `OperatorOrder/OrderTemplate?outletId=${outletId}`)
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} templates`
    }),
  )

  results.push(
    await runCheck(`OperatorOrder/Outlet/${outletId}/DeliveryAddress`, async () => {
      const j = await apiCall(token, `OperatorOrder/Outlet/${outletId}/DeliveryAddress`)
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} addresses`
    }),
  )

  // Inventory
  results.push(
    await runCheck('InventoryAdjustment/Outlet', async () => {
      const j = await apiCall(token, 'InventoryAdjustment/Outlet')
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} outlets`
    }),
  )

  results.push(
    await runCheck('InventoryAdjustment/List', async () => {
      const j = await apiCall(token, 'InventoryAdjustment/List', {
        method: 'POST',
        body: {
          pageSize: 5,
          pageIndex: 1,
          fromDate: null,
          toDate: null,
          inventoryFilterType: null,
          inventoryMethod: null,
          status: 'AutoCompleted',
          outletId,
        },
      })
      const list = entity(j)
      const rows = Array.isArray(list) ? list : []
      if (rows[0]?.id) inventoryId = rows[0].id
      return `${rows.length} adjustments`
    }),
  )

  if (inventoryId) {
    results.push(
      await runCheck(`InventoryAdjustment/${inventoryId}`, async () => {
        await apiCall(token, `InventoryAdjustment/${inventoryId}`)
        return 'detail loaded'
      }),
    )
  }

  results.push(
    await runCheck(`InventoryAdjustment/Outlet/${outletId}/Storage/Location`, async () => {
      const j = await apiCall(token, `InventoryAdjustment/Outlet/${outletId}/Storage/Location`)
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} locations`
    }),
  )

  results.push(
    await runCheck(`InventoryAdjustment/Outlet/${outletId}/Storage`, async () => {
      const j = await apiCall(token, `InventoryAdjustment/Outlet/${outletId}/Storage`)
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} storages`
    }),
  )

  results.push(
    await runCheck('InventoryAdjustment/Ingredient/List', async () => {
      const j = await apiCall(token, 'InventoryAdjustment/Ingredient/List', {
        method: 'POST',
        body: {
          pageSize: 10,
          pageIndex: 1,
          outletId,
          keyword: '',
          categoryId: null,
          groupId: null,
          storageId: null,
          outletStorageLocationId: null,
        },
      })
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} ingredients`
    }),
  )

  // Transfer
  results.push(
    await runCheck('Transfer/GetOutlet', async () => {
      const j = await apiCall(token, 'Transfer/GetOutlet')
      const list = entity(j)
      const outlets = Array.isArray(list) ? list : []
      return `${outlets.length} from-outlets`
    }),
  )

  results.push(
    await runCheck(`Transfer/GetToOutlet/${outletId}`, async () => {
      const j = await apiCall(token, `Transfer/GetToOutlet/${outletId}`)
      const list = entity(j)
      const outlets = Array.isArray(list) ? list : []
      toOutletId = outlets[0]?.outletId ?? outlets[0]?.id ?? null
      return `${outlets.length} to-outlets`
    }),
  )

  if (toOutletId) {
    results.push(
      await runCheck('Transfer/GetGroupProducts', async () => {
        const qs = `fromOutletId=${outletId}&toOutletId=${toOutletId}`
        const j = await apiCall(token, `Transfer/GetGroupProducts?${qs}`)
        const list = entity(j)
        const rows = Array.isArray(list) ? list : []
        const sample = rows.find((r) => r.id || r.ingredientId)
        if (sample) ingredientId = sample.id ?? sample.ingredientId
        return `${rows.length} catalog items`
      }),
    )
    if (ingredientId) {
      results.push(
        await runCheck('Transfer/GetGroupProductDetail', async () => {
          const qs = `ingredientId=${ingredientId}&returnLowAndHighPrice=true&outletId=${outletId}&toOutletId=${toOutletId}`
          await apiCall(token, `Transfer/GetGroupProductDetail?${qs}`)
          return 'detail loaded'
        }),
      )
    }
  }

  results.push(
    await runCheck('Transfer/List', async () => {
      const j = await apiCall(token, 'Transfer/List', {
        method: 'POST',
        body: {
          pageSize: 5,
          pageIndex: 1,
          searchDate: null,
          fromOutletId: outletId,
          transfer: null,
          month: null,
          year: null,
          currency: null,
          keyword: null,
        },
      })
      const list = entity(j)
      const rows = Array.isArray(list) ? list : []
      if (rows[0]?.id) transferId = rows[0].id
      return `${rows.length} transfers`
    }),
  )

  if (transferId) {
    results.push(
      await runCheck(`Transfer/GetTransfer/${transferId}`, async () => {
        await apiCall(token, `Transfer/GetTransfer/${transferId}`)
        return 'detail loaded'
      }),
    )
  }

  // Wastage
  results.push(
    await runCheck('Wastage/GetGroupProducts', async () => {
      const j = await apiCall(token, `Wastage/GetGroupProducts?outletId=${outletId}`)
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} catalog items`
    }),
  )

  results.push(
    await runCheck('Wastage/List', async () => {
      const j = await apiCall(token, 'Wastage/List', {
        method: 'POST',
        body: {
          pageSize: 5,
          pageIndex: 1,
          selectedOutletId: outletId,
          selectedPeriod: null,
          selectedSortBy: null,
          keyword: null,
        },
      })
      const list = entity(j)
      const rows = Array.isArray(list) ? list : []
      if (rows[0]?.id) wastageId = rows[0].id
      return `${rows.length} wastage records`
    }),
  )

  if (wastageId) {
    results.push(
      await runCheck(`Wastage/GetWastage/${wastageId}`, async () => {
        await apiCall(token, `Wastage/GetWastage/${wastageId}`)
        return 'detail loaded'
      }),
    )
  }

  return results
}

async function probeVendor(token) {
  const results = []
  let outletId = 1209
  let clientOutletId = null
  let orderId = null

  results.push(
    await runCheck('Account/Detail', async () => {
      const j = await apiCall(token, 'Account/Detail')
      const e = entity(j)
      const outlets = e?.outlets || []
      if (outlets[0]?.outletId) outletId = outlets[0].outletId
      return `${e?.userType || '?'} / outlet ${outletId}`
    }),
  )

  results.push(
    await runCheck('VendorOrder/List', async () => {
      const j = await apiCall(token, 'VendorOrder/List', {
        method: 'POST',
        body: {
          PageSize: 5,
          PurchaseOrderNumber: '',
          OperatorCompanyIds: [],
          CreatedDateFrom: null,
          CreatedDateTo: null,
          Status: ['Submitted', 'Accepted', 'Received'],
          PageIndex: 1,
        },
      })
      const list = entity(j)
      const orders = Array.isArray(list) ? list : []
      if (orders[0]?.id) orderId = orders[0].id
      return `${orders.length} orders${orderId ? ` (sample ${orderId})` : ''}`
    }),
  )

  if (orderId) {
    results.push(
      await runCheck(`VendorOrder/${orderId}`, async () => {
        await apiCall(token, `VendorOrder/${orderId}`)
        return 'detail loaded'
      }),
    )
    results.push(
      await runCheck(`VendorOrder/GetPOClipboard?id=${orderId}`, async () => {
        const j = await apiCall(token, `VendorOrder/GetPOClipboard?id=${orderId}`)
        const e = entity(j)
        return typeof e === 'string' ? e.slice(0, 60) : JSON.stringify(e).slice(0, 60)
      }),
    )
  }

  results.push(
    await runCheck('VendorOrder/VirtualOutlet', async () => {
      const j = await apiCall(token, 'VendorOrder/VirtualOutlet')
      const list = entity(j)
      const clients = Array.isArray(list) ? list : []
      if (clients[0]?.outletId) clientOutletId = clients[0].outletId
      return `${clients.length} virtual clients`
    }),
  )

  const cartOutlet = clientOutletId || outletId

  results.push(
    await runCheck('VendorOrder/Ingredient', async () => {
      const j = await apiCall(token, 'VendorOrder/Ingredient', {
        method: 'POST',
        body: {
          pageSize: 10,
          pageIndex: 1,
          outletId: cartOutlet,
          categoryId: null,
          groupId: null,
          keyword: null,
        },
      })
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} products`
    }),
  )

  results.push(
    await runCheck(`VendorOrder/Cart?outletId=${cartOutlet}`, async () => {
      const j = await apiCall(token, `VendorOrder/Cart?outletId=${cartOutlet}`)
      const list = entity(j)
      return `${Array.isArray(list) ? list.length : 0} cart vendors`
    }),
  )

  if (clientOutletId) {
    results.push(
      await runCheck(`VendorOrder/Outlet/${clientOutletId}/DeliveryAddress`, async () => {
        const j = await apiCall(token, `VendorOrder/Outlet/${clientOutletId}/DeliveryAddress`)
        const list = entity(j)
        return `${Array.isArray(list) ? list.length : 0} addresses`
      }),
    )
  }

  return results
}

function printSection(title, results) {
  console.log(`\n=== ${title} ===`)
  const fails = results.filter((r) => r.status === 'fail')
  for (const r of results) {
    const icon = r.status === 'ok' ? 'OK ' : 'FAIL'
    console.log(`${icon}  ${r.label}`)
    if (r.detail) console.log(`      ${r.detail}`)
  }
  return fails
}

async function main() {
  console.log(`Proxy: ${PROXY}`)
  const infra = []

  infra.push(
    await runCheck('Vite dev server', async () => {
      const res = await fetch(`${PROXY}/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return 'reachable'
    }),
  )

  infra.push(
    await runCheck('Identity proxy (/identity)', async () => {
      const res = await fetch(`${PROXY}/identity/connect/token`, { method: 'POST' })
      // 400/415 expected without body — means route exists
      if (res.status === 404) throw new Error('404 — restart Vite dev server')
      return `route up (HTTP ${res.status})`
    }),
  )

  infra.push(
    await runCheck('Mobile API proxy (/mobile-api)', async () => {
      const res = await fetch(`${PROXY}/mobile-api/Account/Detail`)
      if (res.status === 404) throw new Error('404 — restart Vite dev server')
      return `route up (HTTP ${res.status}, auth required)`
    }),
  )

  printSection('Infrastructure', infra)

  const allFails = [...infra.filter((r) => r.status === 'fail')]

  for (const acct of ACCOUNTS) {
    let token
    const login = await runCheck(`${acct.label} login`, async () => {
      token = await tokenLogin(acct.username, acct.password)
      return 'token acquired'
    })
    if (login.status === 'fail' && acct.label === 'Vendor') {
      const retry = await runCheck(`${acct.label} login (alt password)`, async () => {
        token = await tokenLogin(acct.username, '1234')
        return 'token acquired with alt password'
      })
      if (retry.status === 'ok') {
        printSection(`${acct.label} auth`, [retry])
      } else {
        printSection(`${acct.label} auth`, [login, retry])
        allFails.push(login, retry)
        continue
      }
    } else {
      printSection(`${acct.label} auth`, [login])
      if (login.status === 'fail') {
        allFails.push(login)
        continue
      }
    }

    const results =
      acct.label === 'Operator'
        ? await probeOperator(token)
        : await probeVendor(token)
    const fails = printSection(`${acct.label} API endpoints`, results)
    allFails.push(...fails)
  }

  console.log('\n=== Summary ===')
  const total = allFails.length
  if (total === 0) {
    console.log('All checks passed.')
    process.exit(0)
  } else {
    console.log(`${total} check(s) failed.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
