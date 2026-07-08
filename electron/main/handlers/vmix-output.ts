import { createServer, Server, IncomingMessage, ServerResponse } from 'http'
import { WebSocketServer, WebSocket } from 'ws'

const PORT = 7788

let httpServer: Server | null = null
let wss: WebSocketServer | null = null
let isRunning = false
const clients = new Set<WebSocket>()

// Last known state — sent to newly connecting clients so they get current display immediately
let lastState: { type: string; data?: unknown } = { type: 'clear' }
let lastTheme: unknown = null

export function broadcast(type: string, data?: unknown) {
  if (!isRunning) return
  if (type !== 'theme') lastState = { type, data }
  else lastTheme = data
  const msg = JSON.stringify({ type, data })
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  }
}

// ── XML / JSON DataSource helpers ─────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildXml(): string {
  const { type, data } = lastState
  const d = data as Record<string, unknown> | undefined
  const lines: string[] = ['<?xml version="1.0" encoding="utf-8"?>', '<display>']

  lines.push(`  <type>${esc(type)}</type>`)

  if (type === 'verse' && d) {
    const ref = String(d.reference ?? '')
    const text = String(d.text ?? '')
    const translation = String(d.translation ?? '')
    // Parse "John 3:16" into parts
    const refMatch = ref.match(/^(.+?)\s+(\d+):(\d+)/)
    lines.push(`  <reference>${esc(ref)}</reference>`)
    lines.push(`  <book>${esc(refMatch ? refMatch[1] : '')}</book>`)
    lines.push(`  <chapter>${esc(refMatch ? refMatch[2] : '')}</chapter>`)
    lines.push(`  <verse>${esc(refMatch ? refMatch[3] : '')}</verse>`)
    lines.push(`  <translation>${esc(translation)}</translation>`)
    lines.push(`  <text>${esc(text)}</text>`)
    // Split into individual lines for GT Title multi-line fields
    const textLines = text.split(/\n+/).filter(Boolean)
    textLines.forEach((l, i) => lines.push(`  <line${i + 1}>${esc(l)}</line${i + 1}>`))
  } else if (type === 'lyrics' && d) {
    const title = String(d.title ?? '')
    const artist = String(d.artist ?? '')
    const rawLines: string[] = Array.isArray(d.lines) ? (d.lines as string[]).filter((l: string) => !l.startsWith('[')) : []
    lines.push(`  <title>${esc(title)}</title>`)
    lines.push(`  <artist>${esc(artist)}</artist>`)
    lines.push(`  <text>${esc(rawLines.join('\n'))}</text>`)
    rawLines.forEach((l, i) => lines.push(`  <line${i + 1}>${esc(l)}</line${i + 1}>`))
  } else if (type === 'note' && d) {
    const heading = String(d.heading ?? '')
    const html = String(d.html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    lines.push(`  <heading>${esc(heading)}</heading>`)
    lines.push(`  <text>${esc(html)}</text>`)
  }

  lines.push('</display>')
  return lines.join('\n')
}

function handleDataSource(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? '/'
  if (url === '/current.xml' || url === '/current.xml?') {
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    })
    res.end(buildXml())
    return true
  }
  if (url === '/current.json' || url === '/current.json?') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    })
    res.end(JSON.stringify(lastState, null, 2))
    return true
  }
  return false
}

const HTML = (port: number) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ICGC FMT Live Word — Output</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    #root{
      width:100vw;height:100vh;
      display:flex;align-items:center;justify-content:center;
      position:relative;background:#000;
      background-image:linear-gradient(135deg,#0f0c29,#302b63,#24243e);
    }
    #overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);display:none}
    #content{position:relative;z-index:10;text-align:center;padding:6vw;width:100%;max-width:1200px}
    #heading{letter-spacing:.15em;text-transform:uppercase;font-weight:600;margin-bottom:1.2rem;font-size:clamp(.8rem,2vw,1.3rem)}
    #body{font-weight:300;line-height:1.65;font-size:clamp(1.2rem,3.5vw,2.8rem);margin-bottom:1.5rem}
    #ref{letter-spacing:.15em;text-transform:uppercase;font-weight:600;font-size:clamp(.75rem,2vw,1.3rem)}
    #blank{opacity:.12;letter-spacing:.25em;text-transform:uppercase;font-size:clamp(.7rem,1.5vw,1rem);color:#fff}
    #status{
      position:fixed;bottom:.8rem;right:.8rem;
      background:rgba(0,0,0,.7);color:#f97316;
      font-size:.6rem;padding:3px 8px;border-radius:4px;
      font-family:monospace;display:none
    }
  </style>
</head>
<body>
  <div id="root">
    <div id="overlay"></div>
    <div id="content">
      <div id="blank">ICGC FMT LIVE WORD</div>
      <div id="heading" style="display:none"></div>
      <div id="body" style="display:none"></div>
      <div id="ref" style="display:none"></div>
    </div>
  </div>
  <div id="status">connecting…</div>
<script>
  const root=document.getElementById('root')
  const overlay=document.getElementById('overlay')
  const blankEl=document.getElementById('blank')
  const headingEl=document.getElementById('heading')
  const bodyEl=document.getElementById('body')
  const refEl=document.getElementById('ref')
  const statusEl=document.getElementById('status')

  let theme={gradient:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',textColor:'#ffffff',refColor:'#f97316',backgroundImage:null,letterSpacing:.01}
  let retryTimer=null

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

  function applyTheme(){
    if(theme.backgroundImage){
      root.style.cssText='background-image:url('+theme.backgroundImage+');background-size:cover;background-position:center'
      overlay.style.display='block'
    } else {
      root.style.cssText='background:'+( theme.gradient||'#000')
      overlay.style.display='none'
    }
  }

  function clear(){
    blankEl.style.display='block'
    headingEl.style.display='none'
    bodyEl.style.display='none'
    refEl.style.display='none'
  }

  function showVerse(d){
    blankEl.style.display='none'
    headingEl.style.display='none'
    bodyEl.style.display='block'
    bodyEl.textContent=d.text
    bodyEl.style.color=theme.textColor
    bodyEl.style.letterSpacing=(theme.letterSpacing||.01)+'em'
    refEl.style.display='block'
    refEl.textContent=d.reference
    refEl.style.color=theme.refColor
  }

  function showLyrics(d){
    blankEl.style.display='none'
    headingEl.style.display='none'
    const lines=(d.lines||[]).filter(l=>!l.startsWith('['))
    bodyEl.innerHTML=lines.map(l=>'<div>'+esc(l)+'</div>').join('')
    bodyEl.style.display='block'
    bodyEl.style.color=theme.textColor
    bodyEl.style.letterSpacing=(theme.letterSpacing||.01)+'em'
    refEl.style.display=d.title?'block':'none'
    refEl.textContent=d.title||''
    refEl.style.color=theme.refColor
  }

  function showNote(d){
    blankEl.style.display='none'
    if(d.heading){
      headingEl.style.display='block'
      headingEl.textContent=d.heading
      headingEl.style.color=theme.refColor
    } else {
      headingEl.style.display='none'
    }
    bodyEl.innerHTML=d.html||''
    bodyEl.style.display='block'
    bodyEl.style.color=theme.textColor
    bodyEl.style.letterSpacing=(theme.letterSpacing||.01)+'em'
    refEl.style.display='none'
  }

  function handle(msg){
    const{type,data}=msg
    if(type==='theme'){Object.assign(theme,data);applyTheme();return}
    if(type==='verse'){showVerse(data);return}
    if(type==='lyrics'){showLyrics(data);return}
    if(type==='note'){showNote(data);return}
    if(type==='clear'){clear();return}
  }

  function connect(){
    statusEl.style.display='block'
    statusEl.textContent='connecting…'
    const ws=new WebSocket('ws://localhost:${port}')
    ws.onopen=()=>{statusEl.style.display='none';clearTimeout(retryTimer)}
    ws.onmessage=(e)=>{try{handle(JSON.parse(e.data))}catch(err){}}
    ws.onclose=()=>{
      statusEl.style.display='block'
      statusEl.textContent='reconnecting…'
      retryTimer=setTimeout(connect,2000)
    }
    ws.onerror=()=>ws.close()
  }

  applyTheme()
  connect()
</script>
</body>
</html>`

export function startVmixOutput(): number {
  if (isRunning) return PORT

  httpServer = createServer((req, res) => {
    if (handleDataSource(req, res)) return
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(HTML(PORT))
  })

  wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws) => {
    clients.add(ws)
    // Send current state to newly connected client
    if (lastTheme) ws.send(JSON.stringify({ type: 'theme', data: lastTheme }))
    ws.send(JSON.stringify(lastState))
    ws.on('close', () => clients.delete(ws))
    ws.on('error', () => clients.delete(ws))
  })

  httpServer.listen(PORT)
  isRunning = true
  return PORT
}

export function stopVmixOutput(): void {
  isRunning = false
  for (const ws of clients) ws.close()
  clients.clear()
  wss?.close()
  httpServer?.close()
  wss = null
  httpServer = null
}

export function isVmixOutputRunning(): boolean {
  return isRunning
}
