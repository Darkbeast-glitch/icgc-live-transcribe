import { useState, useCallback, useRef } from 'react'
import { ActiveDisplay } from '@shared/types'

export interface MediaItem {
  id: string
  name: string
  src: string
}

interface Props {
  items: MediaItem[]
  onItemsChange: (items: MediaItem[]) => void
  onDisplay: (display: ActiveDisplay) => void
}

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

export default function MediaPanel({ items, onItemsChange, onDisplay }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [fit, setFit] = useState<'contain' | 'cover'>('contain')
  const activeItemRef = useRef<MediaItem | null>(null)

  const pickImage = useCallback(async () => {
    const result = await window.api.loadImageForDisplay()
    if (!result) return
    const item: MediaItem = { id: genId(), name: result.name, src: result.dataUrl }
    onItemsChange([...items, item])
  }, [items, onItemsChange])

  const displayItem = useCallback((item: MediaItem, cap?: string, fitMode?: 'contain' | 'cover') => {
    const resolvedFit = fitMode ?? fit
    window.api.showImage({ src: item.src, caption: cap ?? '', fit: resolvedFit })
    setActiveId(item.id)
    activeItemRef.current = item
    onDisplay({ type: 'image', image: { src: item.src, caption: cap ?? '', fit: resolvedFit } })
  }, [onDisplay, fit])

  const switchFit = useCallback((newFit: 'contain' | 'cover') => {
    setFit(newFit)
    if (activeItemRef.current) {
      const item = activeItemRef.current
      window.api.showImage({ src: item.src, caption, fit: newFit })
      onDisplay({ type: 'image', image: { src: item.src, caption, fit: newFit } })
    }
  }, [caption, onDisplay])

  const removeItem = useCallback((id: string) => {
    onItemsChange(items.filter((i) => i.id !== id))
    if (activeId === id) setActiveId(null)
  }, [items, activeId, onItemsChange])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#252528] shrink-0 bg-[#0e0e11]">
        <button
          onClick={pickImage}
          className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium rounded transition-colors"
        >
          <span>+</span> Add Image
        </button>
        <div className="flex-1" />
        {/* Fit toggle */}
        <div className="flex items-center gap-1 bg-[#1a1a1e] border border-[#333338] rounded-lg p-0.5">
          <button
            onClick={() => switchFit('contain')}
            title="Fit — show full image with borders"
            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
              fit === 'contain' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Fit
          </button>
          <button
            onClick={() => switchFit('cover')}
            title="Fill — stretch image to cover full screen"
            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
              fit === 'cover' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Fill
          </button>
        </div>
        <span className="text-slate-600 text-xs">{items.length} image{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Caption input */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#252528] shrink-0">
        <span className="text-slate-500 text-xs shrink-0">Caption:</span>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Optional caption shown on projector…"
          className="flex-1 bg-[#1a1a1e] border border-[#333338] rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a1e] border border-[#333338] flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">No images yet</p>
              <p className="text-slate-700 text-xs mt-1">Click "Add Image" to load artwork, announcements, or photos</p>
            </div>
            <button
              onClick={pickImage}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Choose an image
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {items.map((item) => {
              const isActive = item.id === activeId
              return (
                <div
                  key={item.id}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-colors cursor-pointer ${
                    isActive ? 'border-orange-500' : 'border-[#252528] hover:border-[#333338]'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-[#111113] relative">
                    <img
                      src={item.src}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    {isActive && (
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-orange-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="px-2 py-1.5 bg-[#111113]">
                    <p className="text-slate-400 text-[10px] truncate">{item.name}</p>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                    <button
                      onClick={() => displayItem(item, caption, fit)}
                      className="w-full py-1 bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-semibold rounded-lg transition-colors"
                    >
                      ▶ Display
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-full py-1 bg-[#1e1e22] hover:bg-red-900/50 border border-[#333338] hover:border-red-700 text-slate-400 hover:text-red-400 text-[10px] rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
