import { apiDashboard } from '../lib/api'

export async function fetchDashboard() {
  return apiDashboard()
}
