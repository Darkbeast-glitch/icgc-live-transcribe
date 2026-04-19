export interface ProjectorTheme {
  id: string
  name: string
  bgColor: string
  gradient: string
  textColor: string
  refColor: string
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  backgroundImage?: string // base64 data URL
}

export const PRESET_THEMES = [
  {
    id: 'classic',
    name: 'Classic Dark',
    bgColor: '#000000',
    gradient: 'linear-gradient(180deg, #0f172a 0%, #000000 50%, #0f172a 100%)',
    textColor: '#ffffff',
    refColor: 'rgba(255,255,255,0.65)',
  },
  {
    id: 'deep-blue',
    name: 'Deep Blue',
    bgColor: '#060b2e',
    gradient: 'linear-gradient(180deg, #0c1445 0%, #060b2e 50%, #0c1445 100%)',
    textColor: '#e0f0ff',
    refColor: 'rgba(147,197,253,0.85)',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    bgColor: '#130730',
    gradient: 'linear-gradient(180deg, #1e0b4e 0%, #130730 50%, #1e0b4e 100%)',
    textColor: '#f5f0ff',
    refColor: 'rgba(196,181,253,0.85)',
  },
  {
    id: 'warm',
    name: 'Warm Dark',
    bgColor: '#1a0e05',
    gradient: 'linear-gradient(180deg, #2d1a0a 0%, #1a0e05 50%, #2d1a0a 100%)',
    textColor: '#fff9f0',
    refColor: 'rgba(253,186,116,0.85)',
  },
  {
    id: 'forest',
    name: 'Forest',
    bgColor: '#050f08',
    gradient: 'linear-gradient(180deg, #0a1a0f 0%, #050f08 50%, #0a1a0f 100%)',
    textColor: '#f0fff4',
    refColor: 'rgba(134,239,172,0.85)',
  },
  {
    id: 'light',
    name: 'White',
    bgColor: '#f8fafc',
    gradient: 'linear-gradient(180deg, #f1f5f9 0%, #f8fafc 50%, #f1f5f9 100%)',
    textColor: '#1e293b',
    refColor: '#64748b',
  },
] as const

export const FONT_SIZES = {
  sm: { label: 'S', verse: 'clamp(1.2rem, 3vw, 2.2rem)', lyrics: 'clamp(1.3rem, 3.5vw, 2.4rem)' },
  md: { label: 'M', verse: 'clamp(1.5rem, 4vw, 2.8rem)', lyrics: 'clamp(1.6rem, 4.5vw, 3rem)' },
  lg: { label: 'L', verse: 'clamp(1.9rem, 5vw, 3.6rem)', lyrics: 'clamp(2rem, 5.5vw, 3.8rem)' },
  xl: { label: 'XL', verse: 'clamp(2.3rem, 6.5vw, 4.8rem)', lyrics: 'clamp(2.5rem, 7vw, 5.2rem)' },
} as const

export type FontSizeKey = keyof typeof FONT_SIZES

export function buildTheme(presetId: string, fontSize: FontSizeKey): ProjectorTheme {
  const preset = PRESET_THEMES.find((t) => t.id === presetId) ?? PRESET_THEMES[0]
  return { ...preset, fontSize }
}
