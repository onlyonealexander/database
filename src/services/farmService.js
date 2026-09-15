import { apiDashboard, apiListLivestock, apiCreateLivestock, apiUpdateLivestock, apiDeleteLivestock, apiListRecords, apiCreateRecord, apiUpdateRecord, apiDeleteRecord } from '../lib/api'

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

export async function fetchRecords(path) {
  return apiListRecords(path)
}

export async function createRecord(path, payload) {
  return apiCreateRecord(path, payload)
}

export async function updateRecord(path, id, payload) {
  return apiUpdateRecord(path, id, payload)
}

export async function removeRecord(path, id) {
  return apiDeleteRecord(path, id)
}
