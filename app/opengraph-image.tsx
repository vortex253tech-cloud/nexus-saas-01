import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0E16',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180,
            left: 200,
            width: 900,
            height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, #2563EB 0%, transparent 70%)',
            opacity: 0.35,
            filter: 'blur(2px)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 28, height: 28, background: '#FFFFFF', borderRadius: 6 }} />
          </div>
          <span style={{ fontSize: 56, fontWeight: 900, color: '#FFFFFF', letterSpacing: -1 }}>NEXUS</span>
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: '#FFFFFF',
            textAlign: 'center',
            maxWidth: 880,
            lineHeight: 1.2,
          }}
        >
          Seu COO de IA que opera sua empresa em tempo real
        </div>
        <div style={{ fontSize: 22, color: '#94A3B8', marginTop: 24 }}>nexusaas.com.br</div>
      </div>
    ),
    { ...size },
  )
}
