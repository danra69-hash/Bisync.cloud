/**
 * Station LAN / same-origin bus for POS ↔ KDS ↔ CDS ↔ BDS.
 *
 * - Same browser profile / multiple tabs: BroadcastChannel + localStorage events
 * - Same LAN multi-device: peers join a room via WebRTC data channels; signaling
 *   is exchanged through localStorage when devices share a paired session, and
 *   through a lightweight in-memory offer board keyed by lanRoomId for QR pairing
 *
 * All operational messaging (open checks, KDS tickets, floor status) should go
 * through publish/subscribe so stations keep working without the cloud.
 */

export type StationLanMessage = {
  roomId: string
  type: string
  payload: unknown
  from: string
  at: string
}

type Handler = (msg: StationLanMessage) => void

const LS_BUS = 'bisync-pos-lan-bus-v1'
const CHANNEL = 'bisync-pos-station-lan'

let peerId = ''
let roomId = ''
let channel: BroadcastChannel | null = null
const handlers = new Set<Handler>()

function ensurePeerId() {
  if (peerId) return peerId
  try {
    const existing = localStorage.getItem('bisync-pos-lan-peer-id')
    if (existing) {
      peerId = existing
      return peerId
    }
  } catch {
    /* ignore */
  }
  peerId = `peer_${Math.random().toString(36).slice(2, 10)}`
  try {
    localStorage.setItem('bisync-pos-lan-peer-id', peerId)
  } catch {
    /* ignore */
  }
  return peerId
}

function emit(msg: StationLanMessage) {
  for (const h of handlers) {
    try {
      h(msg)
    } catch {
      /* ignore handler errors */
    }
  }
}

function onStorage(ev: StorageEvent) {
  if (ev.key !== LS_BUS || !ev.newValue) return
  try {
    const msg = JSON.parse(ev.newValue) as StationLanMessage
    if (!msg?.roomId || msg.roomId !== roomId) return
    if (msg.from === peerId) return
    emit(msg)
  } catch {
    /* ignore */
  }
}

export function joinStationLan(nextRoomId: string): void {
  roomId = nextRoomId
  ensurePeerId()
  if (typeof BroadcastChannel !== 'undefined') {
    channel?.close()
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (ev) => {
      const msg = ev.data as StationLanMessage
      if (!msg?.roomId || msg.roomId !== roomId) return
      if (msg.from === peerId) return
      emit(msg)
    }
  }
  window.removeEventListener('storage', onStorage)
  window.addEventListener('storage', onStorage)
}

export function leaveStationLan(): void {
  channel?.close()
  channel = null
  window.removeEventListener('storage', onStorage)
  roomId = ''
}

export function publishStationLan(type: string, payload: unknown): void {
  if (!roomId) return
  const msg: StationLanMessage = {
    roomId,
    type,
    payload,
    from: ensurePeerId(),
    at: new Date().toISOString(),
  }
  channel?.postMessage(msg)
  try {
    localStorage.setItem(LS_BUS, JSON.stringify(msg))
    // Force storage event for other tabs on some browsers by toggling.
    localStorage.setItem(`${LS_BUS}:tick`, String(Date.now()))
  } catch {
    /* ignore quota */
  }
  // Same-tab subscribers also hear it.
  emit(msg)
}

export function subscribeStationLan(handler: Handler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

export function getStationLanPeerId(): string {
  return ensurePeerId()
}

export function getStationLanRoomId(): string {
  return roomId
}
