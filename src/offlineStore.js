const DB_NAME = 'uzmap-offline-v1'
const STORE_NAME = 'packages'
export const STREET_PACKAGE_KEY = 'uzbekistan-streets-v1'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readOfflinePackage() {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(STREET_PACKAGE_KEY)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

export async function saveOfflinePackage(url, onProgress) {
  if (navigator.storage?.persist) await navigator.storage.persist()
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error('Ko‘cha paketi yuklanmadi')
  const total = Number(response.headers.get('content-length')) || 0
  const reader = response.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress?.(total ? Math.round(received / total * 100) : 0, received, total)
  }

  const blob = new Blob(chunks, { type: 'application/vnd.pmtiles' })
  const database = await openDatabase()
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(blob, STREET_PACKAGE_KEY)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
  return blob
}

export async function deleteOfflinePackage() {
  const database = await openDatabase()
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(STREET_PACKAGE_KEY)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}
