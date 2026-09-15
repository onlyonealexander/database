import { apiDashboard, apiListLivestock, apiCreateLivestock, apiUpdateLivestock, apiDeleteLivestock } from '../lib/api'

export async function fetchDashboard() {
  return apiDashboard()
}

export async function fetchLivestock() {
  return apiListLivestock()
}

export async function createLivestock(payload) {
  return apiCreateLivestock(payload)
}

export async function updateLivestock(id, payload) {
  return apiUpdateLivestock(id, payload)
}

export async function removeLivestock(id) {
  return apiDeleteLivestock(id)
}
