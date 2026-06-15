import { redirect } from 'next/navigation'

// Alias en español — redirige permanentemente a la ruta canónica
export default function CambiarContrasenaPage() {
  redirect('/change-password')
}
