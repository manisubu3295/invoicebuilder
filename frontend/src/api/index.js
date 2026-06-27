import api from './axios';

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const clientsApi = {
  list: () => api.get('/clients'),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  remove: (id) => api.delete(`/clients/${id}`),
};

export const invoicesApi = {
  list: (params) => api.get('/invoices', { params }),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  remove: (id) => api.delete(`/invoices/${id}`),
  getPdf: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  sendEmail: (id) => api.post(`/invoices/${id}/send-email`),
  markSent: (id) => api.post(`/invoices/${id}/mark-sent`),
  markPaid: (id, data) => api.post(`/invoices/${id}/mark-paid`, data),
};

export const quotationsApi = {
  list: (params) => api.get('/quotations', { params }),
  get: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  remove: (id) => api.delete(`/quotations/${id}`),
  getPdf: (id) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
  sendEmail: (id) => api.post(`/quotations/${id}/send-email`),
  convertToInvoice: (id) => api.post(`/quotations/${id}/convert-to-invoice`),
};

export const jobsApi = {
  list: (params) => api.get('/jobs', { params }),
  get: (id) => api.get(`/jobs/${id}`),
  create: (data) => api.post('/jobs', data),
  update: (id, data) => api.put(`/jobs/${id}`, data),
  updateStatus: (id, status) => api.put(`/jobs/${id}/status`, { status }),
};

export const driversApi = {
  list: () => api.get('/drivers'),
  create: (data) => api.post('/drivers', data),
  update: (id, data) => api.put(`/drivers/${id}`, data),
};

export const vehiclesApi = {
  list: () => api.get('/vehicles'),
  create: (data) => api.post('/vehicles', data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  remove: (id) => api.delete(`/vehicles/${id}`),
};

export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  revenue: (year) => api.get('/reports/revenue', { params: { year } }),
  aging: () => api.get('/reports/aging'),
  clientSummary: () => api.get('/reports/client-summary'),
  driverSummary: () => api.get('/reports/driver-summary'),
  vehicleSummary: () => api.get('/reports/vehicle-summary'),
  expenseSummary: () => api.get('/reports/expense-summary'),
  attendance: (params) => api.get('/reports/attendance', { params }),
  pnl: (year) => api.get('/reports/pnl', { params: { year } }),
  soa: (clientId) => api.get(`/reports/soa/${clientId}`),
  soaPdf: (clientId) => api.get(`/reports/soa/${clientId}/pdf`, { responseType: 'blob' }),
  payroll: (params) => api.get('/reports/payroll', { params }),
  payrollPdf: (params) => api.get('/reports/payroll/pdf', { params, responseType: 'blob' }),
  jobSummary: (params) => api.get('/reports/job-summary', { params }),
  arAction: () => api.get('/reports/ar-action'),
  fleetCompliancePdf: () => api.get('/reports/fleet-compliance/pdf', { responseType: 'blob' }),
};

export const jobAttendanceApi = {
  list: (jobId) => api.get('/job-attendance', { params: { jobId } }),
  activeSessions: () => api.get('/job-attendance/active'),
  checkin: (data) => api.post('/job-attendance', data),
  checkout: (id, data) => api.put(`/job-attendance/${id}/end`, data),
  ping: (id, data) => api.put(`/job-attendance/${id}/ping`, data),
  forceEnd: (id) => api.put(`/job-attendance/${id}/force-end`),
};

export const expensesApi = {
  list: (params) => api.get('/expenses', { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  remove: (id) => api.delete(`/expenses/${id}`),
  approve: (id, data) => api.post(`/expenses/${id}/approve`, data),
  reject: (id, data) => api.post(`/expenses/${id}/reject`, data),
};

export const usersApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

export const itemCatalogApi = {
  list: (params) => api.get('/item-catalog', { params }),
  create: (data) => api.post('/item-catalog', data),
  update: (id, data) => api.put(`/item-catalog/${id}`, data),
  remove: (id) => api.delete(`/item-catalog/${id}`),
};

export const deliveriesApi = {
  list: (params) => api.get('/deliveries', { params }),
  get: (id) => api.get(`/deliveries/${id}`),
  deliverers: () => api.get('/deliveries/deliverers'),
  preview: (params) => api.get('/deliveries/preview', { params }),
  create: (data) => api.post('/deliveries', data),
  update: (id, data) => api.put(`/deliveries/${id}`, data),
  remove: (id) => api.delete(`/deliveries/${id}`),
  createInvoice: (data) => api.post('/invoices/from-deliveries', data),
};
