import { apiLogin, apiMe, apiSignOut } from '../lib/api'

export async function signIn(email, password) {
  return apiLogin(email, password)
}

export async function getSessionProfile() {
  return apiMe()
}

export function signOut() {
  apiSignOut()
  window.location.reload()
}
