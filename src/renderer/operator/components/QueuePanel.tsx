import { QueueItem } from '@shared/types'

interface Props {
  queue: QueueItem[]
  recentDetections: QueueItem[]
  nowShowingId: string | null
  onPresent: (item: QueueItem) => void
  onPreview: (item: QueueItem) => void
  onRemove: (id: string) => void
  onClearQueue: () => void
  onClearDetections: () => void
}

export default function QueuePanel({
  queue, recentDetections, nowShowingId,
  onPresent, onPreview, onRemove, onClearQueue, onClearDetections,
}: Props) {
  return (
    <div className="flex flex-col w-72 shrink-0 border-l border-[#252528]">
      {/* Queue */}
      <div className="flex flex-col border-b border-[#252528]" style={{ maxHeight: '45%' }}>
        <div className="flex items-center justify-between px-3 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 text-xs font-medium">Queue</span>
            {queue.length > 0 && (
              <span className="text-xs bg-[#2a2a2f] text-slate-400 rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {queue.length}
              </span>
            )}
          </div>
          {queue.length > 0 && (
            <button onClick={onClearQueue} className="text-slate-600 hover:text-red-400 text-[10px] transition-colors">
              Clear all
            </button>
          )}
        </div>

        <div className="overflow-y-auto min-h-0">
          {queue.length === 0 ? (
            <p className="text-slate-700 text-xs text-center py-6 px-3">
              Add verses here to run through them in order
            </p>
          ) : (
            queue.map((item) => (
              <div
                key={item.id}
                onDoubleClick={() => onPresent(item)}
                className={`flex items-center gap-2 px-3 py-2 border-b border-[#1e1e22] transition-colors cursor-pointer ${
                  nowShowingId === item.id ? 'bg-orange-950/30' : 'hover:bg-[#1a1a1e]'
                }`}
              >
                {nowShowingId === item.id && (
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0 animate-pulse" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{item.reference}</p>
                  <p className="text-slate-600 text-[10px]">{item.translation}</p>
                </div>
                {/* Always-visible buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onPreview(item) }}
                    title="Send to Program Preview"
                    className="px-1.5 py-0.5 text-[10px] rounded border border-[#333338] text-slate-500 hover:text-white hover:border-slate-500 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onPresent(item) }}
                    title="Present live"
                    className="w-6 h-6 flex items-center justify-center bg-orange-500 hover:bg-orange-400 text-white rounded text-[10px] transition-colors shrink-0"
                  >
                    ▶
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
                    title="Remove from queue"
                    className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors shrink-0 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Detections */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-[#252528]">
          <span className="text-slate-300 text-xs font-medium">Recent detections</span>
          {recentDetections.length > 0 && (
            <button onClick={onClearDetections} className="text-slate-600 hover:text-red-400 text-[10px] transition-colors">
              Clear all
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
          {recentDetections.length === 0 && (
            <p className="text-slate-700 text-xs text-center py-6">
              Verses detected in live transcript will appear here
            </p>
          )}
          {recentDetections.map((item, i) => (
            <div key={item.id + i} className="p-2.5 bg-[#161619] border border-[#252528] rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
                <span className="text-white text-xs font-semibold flex-1 truncate">{item.reference}</span>
              </div>
              <p className="text-slate-500 text-[10px] leading-relaxed line-clamp-2 mb-2">{item.text}</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onPreview(item)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 bg-[#1e1e22] hover:bg-[#252528] border border-[#333338] hover:border-slate-500 text-slate-400 hover:text-white text-[10px] rounded-lg transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => onPresent(item)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 bg-orange-500/20 hover:bg-orange-500 border border-orange-500/30 hover:border-orange-500 text-orange-400 hover:text-white text-[10px] font-medium rounded-lg transition-colors"
                >
                  <span>▶</span> Present
                </button>
                <button
                  onClick={() => onRemove('add:' + item.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 bg-[#1e1e22] hover:bg-[#2a2a2f] border border-[#333338] text-slate-400 hover:text-white text-[10px] rounded-lg transition-colors"
                >
                  + Queue
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
