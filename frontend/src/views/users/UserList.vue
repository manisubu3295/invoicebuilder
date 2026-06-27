<script setup>
import { ref, computed, onMounted } from 'vue';
import { usersApi } from '../../api/index.js';
import { useAuthStore } from '../../stores/auth.js';

const auth = useAuthStore();
const users = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const showForm = ref(false);
const editingId = ref(null);

const blank = () => ({ name: '', email: '', phone: '', role: 'staff', password: '', isActive: true });
const nonDriverUsers = computed(() => users.value.filter(u => u.role !== 'driver'));
const form = ref(blank());
const isEditingSelf = computed(() => editingId.value === auth.user?.id);

onMounted(load);

async function load() {
  loading.value = true;
  try { users.value = (await usersApi.list()).data; }
  finally { loading.value = false; }
}

function openAdd() {
  editingId.value = null; form.value = blank(); error.value = ''; showForm.value = true;
}
function openEdit(user) {
  editingId.value = user.id;
  form.value = { name: user.name, email: user.email, phone: user.phone || '', role: user.role, password: '', isActive: user.isActive };
  error.value = ''; showForm.value = true;
}
function cancelForm() {
  showForm.value = false; editingId.value = null; form.value = blank(); error.value = '';
}

async function save() {
  error.value = '';
  if (!form.value.name.trim()) { error.value = 'Name is required.'; return; }
  if (!form.value.email.trim()) { error.value = 'Email is required.'; return; }
  if (!editingId.value && !form.value.password) { error.value = 'Password is required for new users.'; return; }
  saving.value = true;
  try {
    const payload = { ...form.value };
    if (!payload.password) delete payload.password;
    if (editingId.value) {
      const { data } = await usersApi.update(editingId.value, payload);
      const idx = users.value.findIndex(u => u.id === editingId.value);
      if (idx !== -1) users.value[idx] = { ...users.value[idx], ...data };
    } else {
      const { data } = await usersApi.create(payload);
      users.value.push(data);
      users.value.sort((a, b) => a.name.localeCompare(b.name));
    }
    cancelForm();
  } catch (e) {
    error.value = e.response?.data?.message || 'Save failed.';
  } finally {
    saving.value = false;
  }
}

async function toggleActive(user) {
  if (user.id === auth.user?.id) return;
  try {
    const { data } = await usersApi.update(user.id, { isActive: !user.isActive });
    const idx = users.value.findIndex(u => u.id === user.id);
    if (idx !== -1) users.value[idx] = { ...users.value[idx], isActive: data.isActive ?? !user.isActive };
  } catch (e) { alert(e.response?.data?.message || 'Update failed.'); }
}
</script>

<template>
  <div class="page-container">

    <div class="page-header">
      <div>
        <h1 class="page-title">User Management</h1>
        <p class="page-subtitle">Admin and staff accounts. Driver accounts are managed on the Drivers page.</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add User
      </button>
    </div>

    <!-- Role info -->
    <div class="grid grid-cols-3 gap-4 mb-5">
      <div class="card-outlined p-4">
        <div class="flex items-center gap-2 mb-2"><span class="badge-admin">Admin</span></div>
        <ul class="text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li>Full access to all modules</li><li>User & settings management</li><li>All delivery logs</li>
        </ul>
      </div>
      <div class="card-outlined p-4">
        <div class="flex items-center gap-2 mb-2"><span class="badge-staff">Staff</span></div>
        <ul class="text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li>Quotations & invoices</li><li>All delivery logs (edit own)</li><li>No users/settings</li>
        </ul>
      </div>
      <div class="card-outlined p-4 bg-gray-50 dark:bg-slate-700/30">
        <div class="flex items-center gap-2 mb-2"><span class="badge-driver">Driver</span></div>
        <p class="text-xs text-gray-400 dark:text-slate-500">Driver accounts are managed on the <RouterLink to="/drivers" class="text-blue-600 hover:underline font-medium">Drivers page</RouterLink>. Creating a driver automatically creates their login.</p>
      </div>
    </div>

    <!-- Form panel -->
    <div v-if="showForm" class="card mb-5">
      <div class="flex items-center justify-between mb-5">
        <h2 class="card-title">{{ editingId ? 'Edit User' : 'Add New User' }}</h2>
        <button @click="cancelForm" class="btn-icon"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <div v-if="error" class="alert-error mb-4">{{ error }}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div class="input-group">
          <label class="input-label">Full Name *</label>
          <input v-model="form.name" type="text" class="input-field" placeholder="John Tan"/>
        </div>
        <div class="input-group">
          <label class="input-label">Email *</label>
          <input v-model="form.email" type="email" :disabled="!!editingId" class="input-field" placeholder="user@akbtransport.com"/>
          <p v-if="editingId" class="text-xs text-gray-400 mt-1 px-3">Email cannot be changed after creation.</p>
        </div>
        <div class="input-group">
          <label class="input-label">Phone</label>
          <input v-model="form.phone" type="text" class="input-field" placeholder="+65 9123 4567"/>
        </div>
        <div class="input-group">
          <label class="input-label">Role *</label>
          <select v-model="form.role" :disabled="isEditingSelf" class="input-field">
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Password {{ editingId ? '(leave blank to keep)' : '*' }}</label>
          <input v-model="form.password" type="password" class="input-field" placeholder="Min. 6 characters"/>
        </div>
        <div v-if="editingId && !isEditingSelf" class="flex items-center pt-6">
          <label class="flex items-center gap-2.5 cursor-pointer">
            <input v-model="form.isActive" type="checkbox" class="w-4 h-4 rounded accent-blue-600"/>
            <span class="text-sm text-gray-700">Active (can log in)</span>
          </label>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button @click="save" :disabled="saving" class="btn-primary">{{ saving ? 'Saving…' : (editingId ? 'Update User' : 'Create User') }}</button>
        <button @click="cancelForm" class="btn-secondary">Cancel</button>
      </div>
    </div>

    <!-- Table -->
    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="text-center py-12 text-gray-400 text-sm">Loading…</div>
      <table v-else class="mat-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Status</th>
            <th class="w-16"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!nonDriverUsers.length">
            <td colspan="6" class="text-center py-12 text-gray-400">No users found.</td>
          </tr>
          <tr v-for="user in nonDriverUsers" :key="user.id" :class="!user.isActive ? 'opacity-50' : ''">
            <td>
              <div class="font-medium text-gray-900">{{ user.name }}</div>
              <div v-if="user.id === auth.user?.id" class="text-xs text-blue-600">You</div>
            </td>
            <td class="text-gray-600">{{ user.email }}</td>
            <td class="text-gray-500">{{ user.phone || '—' }}</td>
            <td><span :class="`badge-${user.role}`">{{ user.role }}</span></td>
            <td>
              <button v-if="user.id !== auth.user?.id" @click="toggleActive(user)"
                :class="user.isActive ? 'badge-active cursor-pointer hover:opacity-80' : 'badge-inactive cursor-pointer hover:opacity-80'"
                :title="user.isActive ? 'Deactivate' : 'Activate'">
                {{ user.isActive ? 'Active' : 'Inactive' }}
              </button>
              <span v-else class="badge-active">Active</span>
            </td>
            <td>
              <button @click="openEdit(user)" class="btn-icon text-gray-400 hover:text-blue-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
