import { COLORS, PURPOSES, type Outfit, type Purpose, type Style, type WardrobeItem, type Weather } from './model'
import { isRainy } from './weather'

const warmthValue = { light: 0, medium: 1, warm: 2 }
const preferredStyle: Record<Purpose, Style> = {
  daily: 'casual',
  work: 'smart',
  date: 'smart',
  outdoor: 'casual',
  sport: 'sport',
}

function warmthScore(item: WardrobeItem, temperature: number): number {
  const ideal = temperature >= 27 ? 0 : temperature >= 18 ? 1 : 2
  if (item.category === 'shoes' || item.category === 'accessory') return 0
  return 2 - Math.abs(warmthValue[item.warmth] - ideal) * 1.4
}

function itemScore(item: WardrobeItem, weather: Weather, purpose: Purpose): number {
  let score = warmthScore(item, weather.feelsLike)
  if (item.style === preferredStyle[purpose]) score += 2.3
  if (purpose === 'date' && item.style === 'casual') score += 0.7
  if (purpose === 'outdoor' && item.style === 'sport') score += 1.2
  if (purpose === 'daily' && item.style === 'smart') score += 0.8
  if (isRainy(weather) && (item.category === 'shoes' || item.category === 'outer')) {
    score += item.rainSafe ? 2.2 : -1.4
  }
  return score
}

function colorScore(items: WardrobeItem[]): number {
  const colors = items.map((item) => COLORS.find((color) => color.id === item.color)!)
  const colored = colors.filter((color) => color.family !== 'neutral' && color.family !== 'other')
  const families = new Set(colored.map((color) => color.family))
  const uniqueColors = new Set(colors.map((color) => color.id))
  return (families.size <= 1 ? 2 : families.size === 2 ? 0.6 : -1.2) + (uniqueColors.size <= 3 ? 0.8 : -0.4)
}

function reasonsFor(items: WardrobeItem[], weather: Weather, purpose: Purpose): string[] {
  const top = items.find((item) => item.category === 'top')!
  const outer = items.find((item) => item.category === 'outer')
  const shoe = items.find((item) => item.category === 'shoes')!
  const purposeName = PURPOSES.find((item) => item.id === purpose)!.label
  const warmth = weather.feelsLike <= 17
    ? outer ? `体感 ${weather.feelsLike}℃，加上「${outer.name}」照顾早晚的凉意。` : top.warmth === 'warm' ? `体感 ${weather.feelsLike}℃，选了衣橱里较保暖的「${top.name}」。` : `体感 ${weather.feelsLike}℃，衣橱里缺少保暖外套，这套可能偏冷。`
    : weather.feelsLike >= 27
      ? top.warmth === 'light' ? `体感 ${weather.feelsLike}℃，选择「${top.name}」让这一身更轻便。` : `体感 ${weather.feelsLike}℃，衣橱里缺少轻薄上衣，这套可能偏热。`
      : `体感 ${weather.feelsLike}℃，这套厚薄适合今天出门。`
  const scene = `按「${purposeName}」挑选了风格更合适的上衣、下装和鞋。`
  const rain = isRainy(weather)
    ? shoe.rainSafe ? `今天可能有雨，「${shoe.name}」更适合雨天。` : '今天可能有雨，衣橱中没有更合适的防雨鞋，出门记得留意路面。'
    : null
  return [warmth, scene, rain].filter((value): value is string => Boolean(value))
}

export function missingCategories(items: WardrobeItem[]): string[] {
  return [
    ['top', '上衣'],
    ['bottom', '下装'],
    ['shoes', '鞋子'],
  ].filter(([category]) => !items.some((item) => item.category === category)).map(([, label]) => label)
}

export function createOutfits(items: WardrobeItem[], weather: Weather, purpose: Purpose): Outfit[] {
  if (missingCategories(items).length) return []
  const best = (category: WardrobeItem['category']) => items
    .filter((item) => item.category === category)
    .sort((a, b) => itemScore(b, weather, purpose) - itemScore(a, weather, purpose))
    .slice(0, 12)

  const tops = best('top')
  const bottoms = best('bottom')
  const shoes = best('shoes')
  const outer = best('outer')
  const wantsOuter = weather.feelsLike <= 18
  const outerChoices: (WardrobeItem | null)[] = wantsOuter && outer.length ? outer : [null]
  if (wantsOuter && outer.length) outerChoices.push(null)

  const candidates: { items: WardrobeItem[]; score: number }[] = []
  for (const top of tops) for (const bottom of bottoms) for (const shoe of shoes) for (const layer of outerChoices) {
    const combination = [top, bottom, shoe, ...(layer ? [layer] : [])]
    let score = combination.reduce((total, item) => total + itemScore(item, weather, purpose), 0)
    score += colorScore(combination)
    if (wantsOuter) score += layer ? 3 : -2.5
    if (!wantsOuter && layer) score -= 2
    candidates.push({ items: combination, score })
  }
  candidates.sort((a, b) => b.score - a.score)

  const selected: typeof candidates = []
  for (const candidate of candidates) {
    if (selected.length === 3) break
    if (selected.some((outfit) => outfit.items.every((item) => candidate.items.some((other) => other.id === item.id)) && outfit.items.length === candidate.items.length)) continue
    const repeatedTop = selected.some((outfit) => outfit.items[0].id === candidate.items[0].id)
    if (repeatedTop && tops.length > selected.length) continue
    selected.push(candidate)
  }
  for (const candidate of candidates) {
    if (selected.length === 3) break
    if (selected.some((outfit) => outfit.items.map((item) => item.id).join('|') === candidate.items.map((item) => item.id).join('|'))) continue
    selected.push(candidate)
  }
  return selected.map(({ items: outfitItems, score }) => ({
    itemIds: outfitItems.map((item) => item.id),
    score,
    reasons: reasonsFor(outfitItems, weather, purpose),
  }))
}
