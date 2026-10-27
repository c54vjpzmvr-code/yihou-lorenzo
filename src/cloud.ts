import { createClient } from '@supabase/supabase-js'
import type { Category, Color, Purpose, SavedOutfit, Style, WardrobeItem, Warmth } from './model'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const bucket = 'wardrobe-images'

export const cloud = url && key ? createClient(url, key) : null

interface WardrobeRow {
  id: string
  user_id: string
  name: string
  category: Category
  color: Color
  warmth: Warmth
  style: Style
  rain_safe: boolean
  image_path: string
  created_at: string
}

interface SavedRow {
  id: string
  user_id: string
  item_ids: string[]
  purpose: Purpose
  temperature: number
  created_at: string
}

function client() {
  if (!cloud) throw new Error('云端服务尚未配置')
  return cloud
}

function toItem(row: WardrobeRow, image: string): WardrobeItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    color: row.color,
    warmth: row.warmth,
    style: row.style,
    rainSafe: row.rain_safe,
    image,
    imagePath: row.image_path,
    createdAt: Date.parse(row.created_at),
  }
}

export async function loadCloudData(userId: string): Promise<{ items: WardrobeItem[]; saved: SavedOutfit[] }> {
  const supabase = client()
  const [itemsResult, savedResult] = await Promise.all([
    supabase.from('wardrobe_items').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('saved_outfits').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  if (itemsResult.error) throw itemsResult.error
  if (savedResult.error) throw savedResult.error

  const rows = (itemsResult.data ?? []) as WardrobeRow[]
  let imageUrls = new Map<string, string>()
  if (rows.length) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(rows.map((row) => row.image_path), 7200)
    if (error) throw error
    imageUrls = new Map()
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) imageUrls.set(entry.path, entry.signedUrl)
    }
  }

  return {
    items: rows.map((row) => toItem(row, imageUrls.get(row.image_path) ?? '')),
    saved: ((savedResult.data ?? []) as SavedRow[]).map((row) => ({
      id: row.id,
      itemIds: row.item_ids,
      purpose: row.purpose,
      temperature: row.temperature,
      createdAt: Date.parse(row.created_at),
    })),
  }
}

export async function saveCloudItem(userId: string, item: WardrobeItem): Promise<WardrobeItem> {
  const supabase = client()
  const imagePath = `${userId}/${item.id}.jpg`
  if (item.image.startsWith('data:')) {
    const image = await fetch(item.image).then((response) => response.blob())
    const { error } = await supabase.storage.from(bucket).upload(imagePath, image, {
      upsert: true,
      contentType: 'image/jpeg',
    })
    if (error) throw error
  } else if (!item.imagePath) {
    throw new Error('请先上传一张衣服照片')
  }

  const { data, error } = await supabase.from('wardrobe_items').upsert({
    id: item.id,
    user_id: userId,
    name: item.name,
    category: item.category,
    color: item.color,
    warmth: item.warmth,
    style: item.style,
    rain_safe: item.rainSafe,
    image_path: imagePath,
    created_at: new Date(item.createdAt).toISOString(),
  }, { onConflict: 'id' }).select().single()
  if (error) throw error

  const { data: signed, error: imageError } = await supabase.storage.from(bucket).createSignedUrl(imagePath, 7200)
  if (imageError) throw imageError
  return toItem(data as WardrobeRow, signed.signedUrl)
}

export async function removeCloudItem(userId: string, item: WardrobeItem, relatedSavedIds: string[]) {
  const supabase = client()
  if (relatedSavedIds.length) {
    const { error } = await supabase.from('saved_outfits').delete().eq('user_id', userId).in('id', relatedSavedIds)
    if (error) throw error
  }
  const { error } = await supabase.from('wardrobe_items').delete().eq('user_id', userId).eq('id', item.id)
  if (error) throw error
  if (item.imagePath) await supabase.storage.from(bucket).remove([item.imagePath])
}

export async function saveCloudOutfit(userId: string, outfit: SavedOutfit) {
  const { error } = await client().from('saved_outfits').upsert({
    id: outfit.id,
    user_id: userId,
    item_ids: outfit.itemIds,
    purpose: outfit.purpose,
    temperature: outfit.temperature,
    created_at: new Date(outfit.createdAt).toISOString(),
  })
  if (error) throw error
}

export async function removeCloudOutfit(userId: string, id: string) {
  const { error } = await client().from('saved_outfits').delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}
