import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 120000, // 2 min for AI processing
});

// Request interceptor
api.interceptors.request.use((config) => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export const claimApi = {
  // Upload documents and process claim
  createClaim: (files, onUploadProgress) => {
    const formData = new FormData();
    files.forEach(file => formData.append('documents', file));
    return api.post('/claims', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress
    });
  },

  // Get all claims
  getClaims: (page = 1, limit = 10) =>
    api.get(`/claims?page=${page}&limit=${limit}`),

  // Get single claim
  getClaim: (id) => api.get(`/claims/${id}`),

  // Delete claim
  deleteClaim: (id) => api.delete(`/claims/${id}`),

  // Override/Adjudicate claim decision
  overrideClaim: (id, decision, approvedAmount, notes) => 
    api.put(`/claims/${id}/override`, { decision, approvedAmount, notes }),

  // Get policy configuration
  getPolicy: () => api.get('/claims/policy'),

  // Update policy configuration
  updatePolicy: (policyData) => api.put('/claims/policy', policyData),

  // Get AI rules engine evaluation metrics
  getEvaluationMetrics: () => api.get('/claims/evaluate'),

  // Health check
  health: () => axios.get(`${API_BASE}/health`).then(r => r.data),
};

export default claimApi;
