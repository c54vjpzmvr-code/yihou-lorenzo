import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, CircleUserRound, CloudRain, CloudSun, Heart,
  ImagePlus, LoaderCircle, LogOut, MapPin, Minus, Pencil, Plus, RefreshCw, Shirt,
  SlidersHorizontal, Sparkles, Sun, Trash2, UploadCloud, X,
} from 'lucide-react'
import {
  CATEGORIES, COLORS, PURPOSES, categoryLabel, colorLabel,
  type Category, type Color, type Outfit, type Purpose, type SavedOutfit,
  type Style, type WardrobeItem, type Warmth, type Weather,
} from './model'
import { createOutfits, missingCategories } from './recommend'
import { loadItems, loadSaved, persistSaved, processImage, removeItem, saveItem } from './storage'
import { getPlaceAtLocation, getWeatherAtLocation, isRainy, weatherDescription } from './weather'
import { cloud, loadCloudData, removeCloudItem, removeCloudOutfit, saveCloudItem, saveCloudOutfit } from './cloud'

type View = 'today' | 'wardrobe' | 'saved'

const emptyWeather: Weather = {
  source: 'manual', city: '', temperature: 22, feelsLike: 22,
  min: null, max: null, rainChance: 0, code: null, wind: null, fetchedAt: null,
}

const styleOptions: { id: Style; label: string }[] = [
  { id: 'casual', label: '休闲' },
  { id: 'smart', label: '利落' },
  { id: 'sport', label: '运动' },
]

const warmthOptions: { id: Warmth; label: string }[] = [
  { id: 'light', label: '轻薄' },
  { id: 'medium', label: '适中' },
  { id: 'warm', label: '保暖' },
]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(date)
}

function WeatherIcon({ weather }: { weather: Weather }) {
  if (isRainy(weather)) return <CloudRain aria-hidden="true" />
  if (weather.code === 0) return <Sun aria-hidden="true" />
  return <CloudSun aria-hidden="true" />
}

function AccountMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return <div className="account-menu" ref={menuRef}>
    <button className="account-trigger" type="button" aria-expanded={open} aria-controls="account-details" onClick={() => setOpen((value) => !value)}>
      <CircleUserRound size={21} aria-hidden="true" />
      <span>{email}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open ? <div className="account-popover" id="account-details">
      <span className="account-caption">当前登录邮箱</span>
      <strong>{email}</strong>
      <button type="button" onClick={onSignOut}><LogOut size={17} aria-hidden="true" />退出登录</button>
    </div> : null}
  </div>
}

interface ItemEditorProps {
  item: WardrobeItem | null
  onClose: () => void
  onSave: (item: WardrobeItem) => Promise<void>
}

function ItemEditor({ item, onClose, onSave }: ItemEditorProps) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<Category>(item?.category ?? 'top')
  const [color, setColor] = useState<Color>(item?.color ?? 'black')
  const [warmth, setWarmth] = useState<Warmth>(item?.warmth ?? 'medium')
  const [style, setStyle] = useState<Style>(item?.style ?? 'casual')
  const [rainSafe, setRainSafe] = useState(item?.rainSafe ?? false)
  const [image, setImage] = useState(item?.image ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file?: File) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      setImage(await processImage(file))
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '图片处理失败')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!image) { setError('先上传一张衣服照片'); return }
    if (!name.trim()) { setError('给这件衣服起个名字'); return }
    setBusy(true)
    setError('')
    try {
      await onSave({
        id: item?.id ?? crypto.randomUUID(), name: name.trim(), category, color,
        warmth, style, rainSafe, image, imagePath: item?.imagePath, createdAt: item?.createdAt ?? Date.now(),
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="editor-header">
          <div><p className="eyebrow">MY WARDROBE</p><h2 id="editor-title">{item ? '编辑单品' : '添加一件衣服'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭" title="关闭"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="editor-layout">
            <div>
              <input ref={fileRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} />
              <button className={`photo-upload ${image ? 'has-photo' : ''}`} type="button" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}>
                {image ? <img src={image} alt="衣服照片预览" /> : <><UploadCloud size={30} /><strong>上传衣服照片</strong><span>点击选择，或拖放到这里</span></>}
                {image ? <span className="photo-change"><ImagePlus size={16} /> 更换照片</span> : null}
              </button>
              <p className="help-text">{cloud ? '照片会保存到你的私人云端衣橱。' : '照片仅保存在当前浏览器，不会上传到服务器。'}</p>
            </div>
            <div className="form-fields">
              <label className="field-label" htmlFor="item-name">单品名称</label>
              <input id="item-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：白色棉质衬衫" maxLength={32} />

              <span className="field-label">类别</span>
              <div className="choice-row" role="group" aria-label="衣服类别">
                {CATEGORIES.map((option) => <button key={option.id} type="button" className={category === option.id ? 'choice active' : 'choice'} onClick={() => setCategory(option.id)}>{option.label}</button>)}
              </div>

              <span className="field-label">主要颜色</span>
              <div className="color-picker" role="group" aria-label="主要颜色">
                {COLORS.map((option) => <button key={option.id} type="button" className={color === option.id ? 'color-option selected' : 'color-option'} title={option.label} aria-label={option.label} aria-pressed={color === option.id} onClick={() => setColor(option.id)}><span style={{ background: option.hex }} />{color === option.id ? <Check size={13} /> : null}</button>)}
              </div>
              <p className="selected-color">{colorLabel(color)}</p>

              <div className="form-pair">
                <div><label className="field-label" htmlFor="item-warmth">厚薄</label><select id="item-warmth" className="select-input" value={warmth} onChange={(event) => setWarmth(event.target.value as Warmth)}>{warmthOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
                <div><label className="field-label" htmlFor="item-style">风格</label><select id="item-style" className="select-input" value={style} onChange={(event) => setStyle(event.target.value as Style)}>{styleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
              </div>
              {(category === 'outer' || category === 'shoes') ? <label className="toggle-field"><input type="checkbox" checked={rainSafe} onChange={(event) => setRainSafe(event.target.checked)} /><span>适合雨天穿</span></label> : null}
            </div>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="editor-actions"><button className="text-button" type="button" onClick={onClose}>取消</button><button className="primary-button" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{item ? '保存修改' : '加入衣橱'}</button></div>
        </form>
      </div>
    </div>
  )
}

function GarmentTile({ item, onEdit, onDelete }: { item: WardrobeItem; onEdit: () => void; onDelete: () => void }) {
  return <article className="garment-tile">
    <div className="garment-photo"><img src={item.image} alt={item.name} /><div className="garment-actions"><button className="icon-button" type="button" onClick={onEdit} aria-label={`编辑${item.name}`} title="编辑"><Pencil size={17} /></button><button className="icon-button" type="button" onClick={onDelete} aria-label={`删除${item.name}`} title="删除"><Trash2 size={17} /></button></div></div>
    <div className="garment-info"><strong>{item.name}</strong><span>{categoryLabel(item.category)} · {colorLabel(item.color)}</span></div>
  </article>
}

function OutfitView({ outfit, items, weather, purpose, position, total, saved, onNext, onPrevious, onSave }: {
  outfit: Outfit; items: WardrobeItem[]; weather: Weather; purpose: Purpose; position: number; total: number;
  saved: boolean; onNext: () => void; onPrevious: () => void; onSave: () => void
}) {
  const chosen = outfit.itemIds.map((id) => items.find((item) => item.id === id)).filter((item): item is WardrobeItem => Boolean(item))
  return <section className="look-result" aria-label="今日推荐穿搭">
    <div className="look-header"><div><p className="eyebrow">TODAY'S LOOK</p><h2>今天，就穿这一套。</h2><p className="look-subtitle">{PURPOSES.find((option) => option.id === purpose)?.label} · 体感 {weather.feelsLike}℃</p></div><span className="look-index">0{position + 1}<small> / 0{total}</small></span></div>
    <div className={`look-pieces count-${chosen.length}`}>
      {chosen.map((item) => <div className="look-piece" key={item.id}><div className="piece-image"><img src={item.image} alt={item.name} /></div><span className="piece-category">{categoryLabel(item.category)}</span><strong>{item.name}</strong></div>)}
    </div>
    <div className="look-bottom"><div className="reason-block"><h3>搭配理由</h3>{outfit.reasons.map((reason, index) => <p key={index}><span className="reason-dot" />{reason}</p>)}</div><div className="look-controls"><button className="icon-button outlined" type="button" onClick={onPrevious} disabled={total < 2} aria-label="上一套" title="上一套"><ArrowLeft size={19} /></button><button className="icon-button outlined" type="button" onClick={onNext} disabled={total < 2} aria-label="换一套" title="换一套"><ArrowRight size={19} /></button><button className={saved ? 'save-button saved' : 'save-button'} type="button" onClick={onSave} aria-pressed={saved}><Heart size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? '已收藏' : '收藏搭配'}</button></div></div>
  </section>
}

function App({ session }: { session: Session | null }) {
  const [view, setView] = useState<View>('today')
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>(session ? [] : loadSaved)
  const [weather, setWeather] = useState<Weather>(emptyWeather)
  const [weatherStatus, setWeatherStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [weatherError, setWeatherError] = useState('')
  const [locationWarning, setLocationWarning] = useState('')
  const [hasWeather, setHasWeather] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const locationStarted = useRef(false)
  const weatherRequest = useRef(0)
  const [purpose, setPurpose] = useState<Purpose>('daily')
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [lookIndex, setLookIndex] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WardrobeItem | null>(null)
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [notice, setNotice] = useState('')
  const [importCount, setImportCount] = useState(0)
  const [importBusy, setImportBusy] = useState(false)
  const refreshRequest = useRef(0)
  const saveBusy = useRef(false)

  const refreshData = useCallback(async (showLoading = false) => {
    const request = ++refreshRequest.current
    if (showLoading) setItemsLoading(true)
    try {
      if (session) {
        const data = await loadCloudData(session.user.id)
        if (request !== refreshRequest.current) return
        setItems(data.items)
        setSavedOutfits(data.saved)
      } else {
        const loaded = await loadItems()
        if (request !== refreshRequest.current) return
        setItems(loaded.sort((a, b) => b.createdAt - a.createdAt))
      }
    } finally {
      if (request === refreshRequest.current) setItemsLoading(false)
    }
  }, [session?.user.id])

  useEffect(() => {
    void refreshData(true).catch(() => setNotice('衣橱读取失败，请稍后重试。'))
    if (!session) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshData().catch(() => setNotice('同步失败，请检查网络连接。'))
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(onVisible, 30 * 60 * 1000)
    return () => {
      refreshRequest.current += 1
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [refreshData, session?.user.id])

  useEffect(() => { if (!session) persistSaved(savedOutfits) }, [savedOutfits, session?.user.id])

  useEffect(() => {
    if (!session || localStorage.getItem(`yihou-imported-${session.user.id}`)) return
    void loadItems().then((localItems) => setImportCount(localItems.length + loadSaved().length)).catch(() => {})
  }, [session?.user.id])

  useEffect(() => {
    if (!locationStarted.current) {
      locationStarted.current = true
      void locate()
    }
  }, [])

  useEffect(() => {
    if (!editorOpen && !deleteTarget) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditorOpen(false)
        setDeleteTarget(null)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onEscape)
    }
  }, [editorOpen, deleteTarget])

  const currentOutfit = outfits[lookIndex]
  const missing = useMemo(() => missingCategories(items), [items])
  const filteredItems = filter === 'all' ? items : items.filter((item) => item.category === filter)
  const currentSaved = currentOutfit ? savedOutfits.some((saved) => saved.itemIds.join('|') === currentOutfit.itemIds.join('|')) : false

  async function locate() {
    const request = ++weatherRequest.current
    setWeatherStatus('loading')
    setWeatherError('')
    setLocationWarning('')
    if (!navigator.geolocation) {
      setWeatherError('当前浏览器不支持定位，请手动设置温度。')
      setWeatherStatus('error')
      setManualOpen(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (request !== weatherRequest.current) return
        if (coords.accuracy > 10000) {
          setLocationWarning(`设备给出的是约 ${Math.round(coords.accuracy / 1000)} 公里范围内的位置，地名和天气可能不准确。请打开设备定位后重新定位。`)
        }
        try {
          const [weatherResult, placeResult] = await Promise.allSettled([
            getWeatherAtLocation(coords.latitude, coords.longitude),
            getPlaceAtLocation(coords.latitude, coords.longitude),
          ])
          if (weatherResult.status === 'rejected') throw weatherResult.reason
          if (request !== weatherRequest.current) return
          setWeather({
            ...weatherResult.value,
            city: placeResult.status === 'fulfilled' ? placeResult.value : '当前位置 · 地名暂不可用',
          })
          setWeatherStatus('ready')
          setHasWeather(true)
          setManualOpen(false)
          setWeatherError(placeResult.status === 'fulfilled' ? '' : '地名查询暂时失败，天气仍按定位坐标获取。')
          setOutfits([])
        } catch (cause) {
          if (request !== weatherRequest.current) return
          setWeatherError(cause instanceof Error ? cause.message : '天气获取失败，请重试。')
          setWeatherStatus('error')
          setManualOpen(true)
        }
      },
      (error) => {
        if (request !== weatherRequest.current) return
        setWeatherError(error.code === 1
          ? '未获得定位权限。请在浏览器中允许位置访问后重试。'
          : error.code === 3 ? '定位超时，请重试或手动设置温度。' : '暂时无法定位，请重试或手动设置温度。')
        setWeatherStatus('error')
        setManualOpen(true)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
  }

  function changeManualWeather(next: Weather) {
    weatherRequest.current += 1
    setWeather(next)
    setWeatherStatus('ready')
    setHasWeather(true)
    setWeatherError('')
    setOutfits([])
  }

  function generate() {
    if (!hasWeather) { setNotice('正在获取当前位置的天气。定位失败时可手动设置温度。'); return }
    if (missing.length) { setNotice(`还缺${missing.join('、')}，先把它们加入衣橱。`); setView('wardrobe'); return }
    const generated = createOutfits(items, weather, purpose)
    setOutfits(generated)
    setLookIndex(0)
    setNotice(generated.length ? '' : '暂时无法组成完整搭配，请再添加几件衣服。')
  }

  function openNewItem() { setEditingItem(null); setEditorOpen(true) }
  function openEditItem(item: WardrobeItem) { setEditingItem(item); setEditorOpen(true) }

  async function handleSaveItem(item: WardrobeItem) {
    const saved = session ? await saveCloudItem(session.user.id, item) : (await saveItem(item), item)
    refreshRequest.current += 1
    setItems((previous) => [saved, ...previous.filter((existing) => existing.id !== saved.id)])
    setOutfits([])
    setNotice(`「${item.name}」已加入衣橱。`)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      if (session) {
        await removeCloudItem(session.user.id, deleteTarget, savedOutfits.filter((outfit) => outfit.itemIds.includes(deleteTarget.id)).map((outfit) => outfit.id))
      } else {
        await removeItem(deleteTarget.id)
      }
      refreshRequest.current += 1
      setItems((previous) => previous.filter((item) => item.id !== deleteTarget.id))
      setSavedOutfits((previous) => previous.filter((outfit) => !outfit.itemIds.includes(deleteTarget.id)))
      setOutfits([])
      setNotice(`已删除「${deleteTarget.name}」。`)
      setDeleteTarget(null)
    } catch {
      setNotice('删除失败，请重试。')
    }
  }

  async function toggleSaveOutfit() {
    if (!currentOutfit || saveBusy.current) return
    saveBusy.current = true
    const key = currentOutfit.itemIds.join('|')
    try {
      if (currentSaved) {
        const saved = savedOutfits.find((outfit) => outfit.itemIds.join('|') === key)
        if (session && saved) await removeCloudOutfit(session.user.id, saved.id)
        setSavedOutfits((previous) => previous.filter((outfit) => outfit.itemIds.join('|') !== key))
      } else {
        const saved = { id: crypto.randomUUID(), itemIds: currentOutfit.itemIds, purpose, temperature: weather.feelsLike, createdAt: Date.now() }
        if (session) await saveCloudOutfit(session.user.id, saved)
        setSavedOutfits((previous) => [saved, ...previous])
      }
    } catch {
      setNotice('收藏同步失败，请稍后重试。')
    } finally {
      saveBusy.current = false
    }
  }

  async function deleteSavedOutfit(id: string) {
    try {
      if (session) await removeCloudOutfit(session.user.id, id)
      setSavedOutfits((previous) => previous.filter((outfit) => outfit.id !== id))
    } catch {
      setNotice('取消收藏失败，请稍后重试。')
    }
  }

  async function importLocalData() {
    if (!session || importBusy) return
    setImportBusy(true)
    try {
      const localItems = await loadItems()
      const localSaved = loadSaved()
      for (const item of localItems) await saveCloudItem(session.user.id, item)
      for (const outfit of localSaved) await saveCloudOutfit(session.user.id, outfit)
      localStorage.setItem(`yihou-imported-${session.user.id}`, '1')
      setImportCount(0)
      await refreshData(true)
      setNotice('这台设备的衣橱和收藏已导入账户。')
    } catch {
      setNotice('导入没有完成，请检查网络后重试。')
    } finally {
      setImportBusy(false)
    }
  }

  return <>
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setView('today')} aria-label="衣候，返回今日推荐"><span className="brand-mark"><Shirt size={24} strokeWidth={1.8} /></span><span><strong>衣候</strong><small>YI HOU</small></span></button>
        <nav className="main-nav" aria-label="主导航"><button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')} type="button">今日搭配</button><button className={view === 'wardrobe' ? 'active' : ''} onClick={() => setView('wardrobe')} type="button">我的衣橱{items.length ? <span>{items.length}</span> : null}</button><button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')} type="button">收藏</button></nav>
        {session ? <AccountMenu email={session.user.email ?? '已登录账号'} onSignOut={() => void cloud?.auth.signOut().catch(() => setNotice('退出失败，请稍后重试。'))} /> : null}
      </header>

      <main>
        {notice ? <div className="notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="关闭提示"><X size={16} /></button></div> : null}
        {session && importCount > 0 ? <div className="import-banner" role="status"><span>这台设备还有 {importCount} 条本地衣橱或收藏记录。</span><button type="button" onClick={() => void importLocalData()} disabled={importBusy}>{importBusy ? '正在导入…' : '导入到账户'}</button><button className="icon-button" type="button" onClick={() => setImportCount(0)} aria-label="暂不导入" title="暂不导入"><X size={16} /></button></div> : null}

        {view === 'today' ? <div className="today-layout">
          <section className="today-setup" aria-labelledby="today-title">
            <div className="date-line"><span className="date-dot" />{formatDate(new Date())}</div>
            <h1 id="today-title">今天穿什么？<br /><em>从你的衣橱开始。</em></h1>
            <p className="intro-copy">看看天气，选好出门的目的。让已有的衣服，组成今天刚刚好的一套。</p>

            <div className="setup-section weather-section">
              <div className="section-heading"><h2>01 / 今天的天气</h2><button className="subtle-button" type="button" onClick={() => setManualOpen((open) => !open)}><SlidersHorizontal size={15} />{manualOpen ? '收起手动设置' : '手动设置'}</button></div>
              <div className="location-row"><MapPin size={17} aria-hidden="true" /><span className="location-label">当前位置：</span><strong>{weatherStatus === 'loading' && !weather.city ? '正在定位…' : weather.city || (weatherStatus === 'error' ? '定位不可用' : '正在定位…')}</strong><button type="button" onClick={() => void locate()} disabled={weatherStatus === 'loading'} aria-label="重新定位" title="重新定位">{weatherStatus === 'loading' ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}</button></div>
              <div className="weather-reading"><div className="weather-icon"><WeatherIcon weather={weather} /></div><div className="temperature">{weatherStatus === 'loading' && !hasWeather ? '··' : hasWeather ? weather.temperature : '--'}<span>°</span></div><div className="weather-meta"><strong>{weatherStatus === 'loading' && !hasWeather ? '正在获取天气' : hasWeather ? weatherDescription(weather.code, weather.rainChance) : '暂无天气信息'}</strong><span>{weather.source === 'live' && hasWeather ? `体感 ${weather.feelsLike}℃ · 自动定位` : hasWeather ? '手动天气 · 可随时修改' : '定位失败后可手动设置温度'}</span></div></div>
              {weather.source === 'live' && weather.min !== null ? <p className="weather-detail">最高 {Math.round(weather.max ?? 0)}° / 最低 {Math.round(weather.min)}° <span>·</span> 降雨概率 {weather.rainChance ?? 0}%</p> : null}
              {locationWarning ? <p className="location-warning" role="status">{locationWarning}</p> : null}
              {weatherError ? <p className="inline-error" role="alert">{weatherError}</p> : null}
              {manualOpen ? <div className="manual-weather"><label htmlFor="manual-temp">体感温度</label><div className="stepper"><button type="button" onClick={() => changeManualWeather({ ...weather, source: 'manual', code: null, feelsLike: Math.max(-20, weather.feelsLike - 1), temperature: Math.max(-20, weather.feelsLike - 1), min: null, max: null })} aria-label="降低温度"><Minus size={16} /></button><input id="manual-temp" type="number" min="-20" max="45" value={weather.feelsLike} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) changeManualWeather({ ...weather, source: 'manual', code: null, feelsLike: value, temperature: value, min: null, max: null }) }} /><span>℃</span><button type="button" onClick={() => changeManualWeather({ ...weather, source: 'manual', code: null, feelsLike: Math.min(45, weather.feelsLike + 1), temperature: Math.min(45, weather.feelsLike + 1), min: null, max: null })} aria-label="升高温度"><Plus size={16} /></button></div><label className="rain-checkbox"><input type="checkbox" checked={isRainy(weather)} onChange={(event) => changeManualWeather({ ...weather, source: 'manual', code: null, rainChance: event.target.checked ? 80 : 0 })} />今天可能下雨</label></div> : null}
            </div>

            <div className="setup-section purpose-section"><div className="section-heading"><h2>02 / 出门做什么</h2></div><div className="purpose-options" role="group" aria-label="出门目的">{PURPOSES.map((option) => <button key={option.id} type="button" className={purpose === option.id ? 'purpose-option active' : 'purpose-option'} onClick={() => { setPurpose(option.id); setOutfits([]) }} aria-pressed={purpose === option.id}><span className="purpose-check">{purpose === option.id ? <Check size={15} /> : null}</span><span><strong>{option.label}</strong><small>{option.detail}</small></span></button>)}</div></div>

            <button className="generate-button" type="button" onClick={generate} disabled={itemsLoading}><Sparkles size={19} />生成今日搭配<ArrowRight size={19} /></button>
            <p className="setup-footnote">只使用你衣橱里的单品。推荐依据天气、场合、厚薄和配色。</p>
          </section>

          <div className="today-output">
            {currentOutfit ? <OutfitView outfit={currentOutfit} items={items} weather={weather} purpose={purpose} position={lookIndex} total={outfits.length} saved={currentSaved} onNext={() => setLookIndex((index) => (index + 1) % outfits.length)} onPrevious={() => setLookIndex((index) => (index - 1 + outfits.length) % outfits.length)} onSave={toggleSaveOutfit} /> : <section className="look-empty" aria-label="搭配预览"><div className="empty-photo"><img src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1400&q=85" alt="悬挂在衣架上的衣服" /></div><div className="empty-content"><span className="empty-serial">YOUR WARDROBE, YOUR LOOK</span><h2>{itemsLoading ? '正在打开你的衣橱' : items.length === 0 ? '好搭配，从自己的衣服开始。' : missing.length ? `再添${missing.join('、')}，就能开始搭配。` : '衣服已就位，今天想去哪？'}</h2><p>{items.length === 0 ? '拍下已有的衣服，标记类别和厚薄。推荐只会从你的衣橱中挑选。' : missing.length ? '完整搭配需要上衣、下装和鞋子；每一件都来自你的衣橱。' : '选好出门目的，点击左侧按钮，看看今天的推荐。'}</p><button className="empty-action" type="button" onClick={items.length && !missing.length ? generate : openNewItem}>{items.length && !missing.length ? '生成搭配' : '添加衣服'}<ArrowRight size={18} /></button></div><span className="empty-corner">衣候 / 001</span></section>}
          </div>
        </div> : null}

        {view === 'wardrobe' ? <section className="collection-page"><div className="collection-header"><div><p className="eyebrow">THE WARDROBE</p><h1>我的衣橱<span className="heading-count">{items.length.toString().padStart(2, '0')}</span></h1><p>把常穿的衣服放在一起，今天的搭配就从这里开始。</p></div><button className="primary-button" type="button" onClick={openNewItem}><Plus size={18} />添加衣服</button></div><div className="category-filters" role="group" aria-label="筛选衣服类别"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部 <span>{items.length}</span></button>{CATEGORIES.map((option) => <button key={option.id} type="button" className={filter === option.id ? 'active' : ''} onClick={() => setFilter(option.id)}>{option.label} <span>{items.filter((item) => item.category === option.id).length}</span></button>)}</div>{itemsLoading ? <p className="loading-line"><LoaderCircle className="spin" size={18} />正在读取衣橱</p> : filteredItems.length ? <div className="garment-grid">{filteredItems.map((item) => <GarmentTile key={item.id} item={item} onEdit={() => openEditItem(item)} onDelete={() => setDeleteTarget(item)} />)}</div> : <div className="collection-empty"><Shirt size={44} strokeWidth={1.1} /><h2>{items.length ? '这个类别还没有衣服' : '衣橱还是空的'}</h2><p>{items.length ? '切换其他类别，或添加一件新衣服。' : '先上传一件常穿的衣服，开始建立自己的衣橱。'}</p></div>}</section> : null}

        {view === 'saved' ? <section className="collection-page"><div className="collection-header"><div><p className="eyebrow">FAVORITE LOOKS</p><h1>收藏的搭配<span className="heading-count">{savedOutfits.length.toString().padStart(2, '0')}</span></h1><p>喜欢的一套，留给下一次出门。</p></div></div>{savedOutfits.length ? <div className="saved-grid">{savedOutfits.map((saved) => { const chosen = saved.itemIds.map((id) => items.find((item) => item.id === id)).filter((item): item is WardrobeItem => Boolean(item)); return <article className="saved-look" key={saved.id}><div className="saved-photos">{chosen.map((item) => <img key={item.id} src={item.image} alt={item.name} />)}</div><div className="saved-info"><div><span>{PURPOSES.find((option) => option.id === saved.purpose)?.label} · {saved.temperature}℃</span><h2>{chosen.map((item) => item.name).join(' + ')}</h2><small>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(saved.createdAt)}</small></div><button className="icon-button" type="button" title="取消收藏" aria-label="取消收藏" onClick={() => void deleteSavedOutfit(saved.id)}><Trash2 size={18} /></button></div></article> })}</div> : <div className="collection-empty"><Bookmark size={43} strokeWidth={1.2} /><h2>还没有收藏的搭配</h2><p>生成搭配后，点一下爱心就能留在这里。</p><button className="text-link" type="button" onClick={() => setView('today')}>去看看今天穿什么 <ArrowRight size={17} /></button></div>}</section> : null}
      </main>
      <footer className="site-footer"><span>衣候 · 穿你所拥有的，过好今天。</span><span>位置用于天气与地名查询 · {session ? '衣橱和收藏保存在私人账户' : '照片保存在本机'}</span></footer>
    </div>

    {editorOpen ? <ItemEditor key={editingItem?.id ?? 'new'} item={editingItem} onClose={() => setEditorOpen(false)} onSave={handleSaveItem} /> : null}
    {deleteTarget ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null) }}><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">删除这件衣服？</h2><p>「{deleteTarget.name}」会从衣橱和包含它的收藏搭配中移除。</p><div className="confirm-actions"><button className="text-button" type="button" onClick={() => setDeleteTarget(null)}>取消</button><button className="danger-button" type="button" onClick={handleDelete}><Trash2 size={17} />删除</button></div></div></div> : null}
  </>
}

export default App
