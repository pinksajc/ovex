import { redirect } from 'next/navigation'

// /propuestas is an alias — the canonical route is /deals
export default function PropuestasPage() {
  redirect('/deals')
}
