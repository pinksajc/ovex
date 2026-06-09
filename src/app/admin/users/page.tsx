import { redirect } from 'next/navigation'

// Legacy route — redirected to the new /usuarios module
export default function AdminUsersPage() {
  redirect('/usuarios')
}
