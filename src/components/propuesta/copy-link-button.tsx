'use client'

import { useState } from 'react'

export function CopyLinkButton({ path, label = 'Copiar link' }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // fallback for browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = url
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`text-xs cursor-pointer transition-colors leading-snug ${
        copied ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-700'
      }`}
    >
      {copied ? 'Link copiado ✓' : label}
    </button>
  )
}
