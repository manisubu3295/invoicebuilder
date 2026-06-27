import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  { path: '/login', component: () => import('../views/auth/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'clients', component: () => import('../views/clients/ClientList.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'clients/new', component: () => import('../views/clients/ClientForm.vue'), meta: { roles: ['admin'] } },
      { path: 'clients/:id/edit', component: () => import('../views/clients/ClientForm.vue'), meta: { roles: ['admin'] } },
      { path: 'quotations', component: () => import('../views/quotations/QuotationList.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'quotations/new', component: () => import('../views/quotations/QuotationForm.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'quotations/:id', component: () => import('../views/quotations/QuotationDetail.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'quotations/:id/edit', component: () => import('../views/quotations/QuotationForm.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'invoices', component: () => import('../views/invoices/InvoiceList.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'invoices/new', component: () => import('../views/invoices/InvoiceForm.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'invoices/:id', component: () => import('../views/invoices/InvoiceDetail.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'invoices/:id/edit', component: () => import('../views/invoices/InvoiceForm.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'jobs', component: () => import('../views/jobs/JobList.vue') },
      { path: 'jobs/new', component: () => import('../views/jobs/JobForm.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'jobs/:id', component: () => import('../views/jobs/JobDetail.vue') },
      { path: 'jobs/:id/edit', component: () => import('../views/jobs/JobForm.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'drivers', component: () => import('../views/drivers/DriverList.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'vehicles', component: () => import('../views/vehicles/VehicleList.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'reports', component: () => import('../views/reports/Reports.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'users', component: () => import('../views/users/UserList.vue'), meta: { roles: ['admin'] } },
      { path: 'settings', component: () => import('../views/settings/Settings.vue'), meta: { roles: ['admin'] } },
      { path: 'delivery-log', component: () => import('../views/deliveries/DeliveryList.vue') },
      { path: 'delivery-log/new', component: () => import('../views/deliveries/DeliveryForm.vue') },
      { path: 'delivery-log/:id/edit', component: () => import('../views/deliveries/DeliveryForm.vue') },
      { path: 'delivery-log/invoice', component: () => import('../views/deliveries/InvoiceFromDeliveries.vue'), meta: { roles: ['admin', 'staff'] } },
      { path: 'item-catalog', component: () => import('../views/itemCatalog/ItemCatalogView.vue'), meta: { roles: ['admin'] } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();

  if (to.meta.public) return next();
  if (!auth.isLoggedIn) return next('/login');

  if (to.meta.roles && !to.meta.roles.includes(auth.user?.role)) {
    return next('/dashboard');
  }

  next();
});

export default router;
