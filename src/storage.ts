import type { SavedOutfit, WardrobeItem } from './model'

const DATABASE = 'yihou-wardrobe'
const VERSION = 1
const SAVED_KEY = 'yihou-saved-v1'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('items')) {
        request.result.createObjectStore('items', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('items', mode)
    const request = action(transaction.objectStore('items'))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const loadItems = () => runRequest<WardrobeItem[]>('readonly', (store) => store.getAll())
export const saveItem = (item: WardrobeItem) => runRequest<IDBValidKey>('readwrite', (store) => store.put(item))
export const removeItem = (id: string) => runRequest<undefined>('readwrite', (store) => store.delete(id))

export function loadSaved(): SavedOutfit[] {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function persistSaved(outfits: SavedOutfit[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(outfits))
}

export async function processImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > 15 * 1024 * 1024) throw new Error('图片不能超过 15 MB')

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('图片无法读取，请换一张试试'))
      element.src = objectUrl
    })
    const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法处理图片')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
