import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SCANNER_ELEMENT_ID = 'qr-scanner-region'

export default function QrScanner() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        (decodedText) => {
          const hash = decodedText.split('/').pop() ?? decodedText
          navigate(`/scan/${hash}`)
        },
        () => {},
      )
      .catch(() => setError('Camera permission denied. Enable camera access in your browser settings.'))

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [navigate])

  return (
    <div className="relative flex min-h-[calc(100vh-120px)] flex-col items-center justify-center bg-black">
      <div id={SCANNER_ELEMENT_ID} className="w-full" />

      {error && (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-md bg-white p-4 text-center text-sm text-earth-900">
          {error}
        </div>
      )}

      <p className="absolute bottom-32 text-center text-sm text-white">
        Point at the QR code on your BharatPure package
      </p>

      <form
        className="absolute bottom-8 flex w-full max-w-xs gap-2 px-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (manualCode.trim()) navigate(`/scan/${manualCode.trim()}`)
        }}
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Enter batch code manually"
          className="flex-1 rounded bg-white/90 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
        />
        <button type="submit" className="rounded bg-primary-800 px-4 py-2 text-sm font-semibold text-white">
          Go
        </button>
      </form>
    </div>
  )
}
