<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  modelValue: Array,
  catalog: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue']);

const items = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

// Dropdown state
const openIdx = ref(-1);
const dropdownStyle = ref({});

// Per-row date input state (not persisted in item, just for the add-date input)
const dateInputs = ref({});

function catalogSuggestions(row) {
  if (!props.catalog.length) return [];
  const q = (row.jobDescription || '').toLowerCase().trim();
  if (!q) return props.catalog.slice(0, 10);
  return props.catalog.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10);
}

function onDescFocus(i, event) {
  const rect = event.target.getBoundingClientRect();
  dropdownStyle.value = {
    position: 'fixed',
    top: (rect.bottom + 2) + 'px',
    left: rect.left + 'px',
    width: '300px',
    zIndex: 9999,
  };
  openIdx.value = i;
}

function onDescInput(i, value) {
  updateItem(i, 'jobDescription', value);
  openIdx.value = i;
}

function onDescBlur(i) {
  setTimeout(() => { if (openIdx.value === i) openIdx.value = -1; }, 200);
}

function selectCatalogItem(rowIdx, catItem) {
  const updated = [...items.value];
  const row = { ...updated[rowIdx] };
  row.jobDescription = catItem.name;
  if (row.itemType === 'delivery') {
    row.unitPrice = catItem.unitPrice || '';
  } else {
    if (catItem.unitPrice) row.rate = catItem.unitPrice;
  }
  row.totalAmount = calcTotal(row);
  updated[rowIdx] = row;
  items.value = updated;
  openIdx.value = -1;
}

function addRow(type = 'service') {
  items.value = [...items.value, {
    sno: items.value.length + 1, itemType: type, jobDescription: '',
    fromDate: '', toDate: '', rate: '', rateType: 'per_week',
    deliveryDate: '', deliveryDates: [], quantity: 1, unitPrice: '', totalAmount: 0,
  }];
}

function removeRow(i) {
  items.value = items.value.filter((_, idx) => idx !== i).map((item, idx) => ({ ...item, sno: idx + 1 }));
}

function calcTotal(item) {
  if (item.itemType === 'delivery') {
    return parseFloat(((parseFloat(item.quantity || 0)) * parseFloat(item.unitPrice || 0)).toFixed(2));
  }
  const rate = parseFloat(item.rate || 0);
  if (!rate || !item.fromDate || !item.toDate) return 0;
  const days = Math.round((new Date(item.toDate) - new Date(item.fromDate)) / 86400000) + 1;
  if (days <= 0) return 0;
  return parseFloat((rate * (item.rateType === 'per_day' ? days : Math.ceil(days / 7))).toFixed(2));
}

function updateItem(i, field, value) {
  const updated = [...items.value];
  updated[i] = { ...updated[i], [field]: value };
  if (field === 'totalAmount') updated[i].totalAmount = parseFloat(value || 0);
  else if (field === 'itemType') { updated[i].totalAmount = 0; updated[i].deliveryDates = []; }
  else updated[i].totalAmount = calcTotal(updated[i]);
  items.value = updated;
}

function addDeliveryDate(i) {
  const dateVal = dateInputs.value[i];
  if (!dateVal) return;
  const updated = [...items.value];
  const row = { ...updated[i] };
  const existing = Array.isArray(row.deliveryDates) ? row.deliveryDates : [];
  if (existing.includes(dateVal)) { dateInputs.value[i] = ''; return; }
  row.deliveryDates = [...existing, dateVal].sort();
  row.deliveryDate = row.deliveryDates[0];
  updated[i] = row;
  items.value = updated;
  dateInputs.value[i] = '';
}

function removeDeliveryDate(i, dateVal) {
  const updated = [...items.value];
  const row = { ...updated[i] };
  row.deliveryDates = (Array.isArray(row.deliveryDates) ? row.deliveryDates : []).filter(d => d !== dateVal);
  row.deliveryDate = row.deliveryDates[0] || '';
  updated[i] = row;
  items.value = updated;
}

function fmtChipDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const inputCls = 'w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 text-sm';
</script>

<template>
  <div class="overflow-x-auto rounded border border-gray-200">
    <table class="w-full text-sm border-collapse min-w-[740px]">
      <thead>
        <tr class="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
          <th class="px-2 py-2.5 text-center w-10">#</th>
          <th class="px-3 py-2.5 text-left">Description</th>
          <th class="px-2 py-2.5 text-center w-[120px]">Date / From</th>
          <th class="px-2 py-2.5 text-center w-[108px]">To Date</th>
          <th class="px-2 py-2.5 text-right w-[108px]">Rate / Price</th>
          <th class="px-2 py-2.5 w-[100px]">Per / Qty</th>
          <th class="px-2 py-2.5 text-right w-[100px]">Amount</th>
          <th class="w-8"></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(item, i) in items" :key="i">
          <!-- Main row -->
          <tr class="border-b border-gray-100 hover:bg-gray-50"
              :class="[item.itemType === 'delivery' ? 'bg-blue-50/30' : '', item.itemType === 'delivery' ? 'border-b-0' : '']">

            <!-- # / type toggle -->
            <td class="px-2 py-2 text-center border-r border-gray-100" :rowspan="item.itemType === 'delivery' ? 2 : 1">
              <div class="text-gray-400 text-xs leading-none">{{ item.sno }}</div>
              <button @click="updateItem(i,'itemType', item.itemType==='delivery'?'service':'delivery')"
                class="text-[10px] font-bold px-1 rounded mt-1"
                :class="item.itemType==='delivery' ? 'text-blue-700 bg-blue-100' : 'text-gray-500 bg-gray-100'"
                :title="item.itemType==='delivery' ? 'Switch to Service' : 'Switch to Delivery'">
                {{ item.itemType === 'delivery' ? 'DEL' : 'SVC' }}
              </button>
            </td>

            <!-- Description — catalog autocomplete via Teleport -->
            <td class="px-2 py-2 border-r border-gray-100" :colspan="item.itemType === 'delivery' ? 3 : 1">
              <input
                :value="item.jobDescription"
                @input="onDescInput(i, $event.target.value)"
                @focus="onDescFocus(i, $event)"
                @blur="onDescBlur(i)"
                :class="inputCls"
                placeholder="Search catalog or type custom…"
                autocomplete="off"
              />
            </td>

            <!-- Date / From (service only) -->
            <template v-if="item.itemType !== 'delivery'">
              <td class="px-2 py-2 border-r border-gray-100">
                <input type="date" :value="item.fromDate"
                  @input="updateItem(i,'fromDate',$event.target.value)"
                  :class="inputCls + ' text-xs'"
                  :style="!item.fromDate ? 'border:1px solid #fca5a5;border-radius:4px;' : ''"/>
              </td>

              <!-- To Date -->
              <td class="px-2 py-2 border-r border-gray-100">
                <input type="date" :value="item.toDate"
                  @input="updateItem(i,'toDate',$event.target.value)"
                  :class="inputCls + ' text-xs'"
                  :style="!item.toDate ? 'border:1px solid #fca5a5;border-radius:4px;' : ''"/>
              </td>

              <!-- Rate -->
              <td class="px-2 py-2 border-r border-gray-100">
                <input type="number" :value="item.rate"
                  @input="updateItem(i, 'rate', $event.target.value)"
                  :class="inputCls + ' text-right'" placeholder="0.00"/>
              </td>

              <!-- Per -->
              <td class="px-2 py-2 border-r border-gray-100">
                <select :value="item.rateType"
                  @change="updateItem(i,'rateType',$event.target.value)"
                  class="w-full bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-0.5">
                  <option value="per_week">Per Week</option>
                  <option value="per_day">Per Day</option>
                </select>
              </td>
            </template>

            <!-- Delivery: price + qty -->
            <template v-else>
              <!-- Rate / Price -->
              <td class="px-2 py-2 border-r border-gray-100">
                <input type="number" :value="item.unitPrice"
                  @input="updateItem(i, 'unitPrice', $event.target.value)"
                  :class="inputCls + ' text-right'" placeholder="0.00"/>
              </td>

              <!-- Qty -->
              <td class="px-2 py-2 border-r border-gray-100">
                <input type="number" :value="item.quantity"
                  @input="updateItem(i,'quantity',$event.target.value)"
                  :class="inputCls + ' text-right'" placeholder="Qty" min="0" step="0.001"/>
              </td>
            </template>

            <!-- Amount -->
            <td class="px-2 py-2 border-r border-gray-100">
              <input type="number" :value="item.totalAmount"
                @input="updateItem(i,'totalAmount',$event.target.value)"
                :class="inputCls + ' text-right font-semibold'" placeholder="0.00"/>
            </td>

            <!-- Remove -->
            <td class="px-1 py-2 text-center" :rowspan="item.itemType === 'delivery' ? 2 : 1">
              <button @click="removeRow(i)" class="text-gray-300 hover:text-red-500 text-lg leading-none font-bold">×</button>
            </td>
          </tr>

          <!-- Delivery date chips row -->
          <tr v-if="item.itemType === 'delivery'" class="border-b border-gray-100 bg-blue-50/30">
            <td colspan="6" class="px-3 pb-2.5 pt-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mr-1">Dates</span>

                <!-- Existing date chips -->
                <span v-for="d in (item.deliveryDates || [])" :key="d"
                  class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {{ fmtChipDate(d) }}
                  <button @click="removeDeliveryDate(i, d)"
                    class="text-blue-400 hover:text-red-500 leading-none font-bold text-sm">&times;</button>
                </span>

                <!-- Empty state hint -->
                <span v-if="!item.deliveryDates?.length"
                  class="text-xs text-red-400 italic">Select at least one date</span>

                <!-- Add date input -->
                <div class="flex items-center gap-1 ml-auto">
                  <input type="date" v-model="dateInputs[i]"
                    @keydown.enter.prevent="addDeliveryDate(i)"
                    class="text-xs border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"/>
                  <button @click="addDeliveryDate(i)"
                    class="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                    title="Add date">+ Add</button>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>

  <!-- Catalog dropdown rendered in body to escape overflow:hidden/auto containers -->
  <Teleport to="body">
    <div v-if="openIdx >= 0 && catalogSuggestions(items[openIdx]).length"
      :style="dropdownStyle"
      class="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
      <div class="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100 flex items-center gap-1">
        <span class="material-icons" style="font-size:12px">auto_awesome</span>
        Item Catalog
      </div>
      <ul class="max-h-48 overflow-y-auto">
        <li v-for="cat in catalogSuggestions(items[openIdx])" :key="cat.id"
          @mousedown.prevent="selectCatalogItem(openIdx, cat)"
          class="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 cursor-pointer gap-3 border-b border-gray-50 last:border-0">
          <span class="text-sm text-gray-800 font-medium truncate">{{ cat.name }}</span>
          <span class="text-xs text-gray-400 shrink-0 tabular-nums">
            {{ cat.unit ? cat.unit + ' · ' : '' }}S${{ parseFloat(cat.unitPrice || 0).toFixed(2) }}
          </span>
        </li>
      </ul>
    </div>
  </Teleport>

  <div class="flex gap-2 mt-3 items-center flex-wrap">
    <button @click="addRow('service')" class="btn-secondary text-xs h-7 px-3">+ Service</button>
    <button @click="addRow('delivery')" class="text-xs h-7 px-3 border border-blue-300 text-blue-700 bg-blue-50 rounded hover:bg-blue-100 font-medium uppercase tracking-wide">+ Delivery</button>
    <span v-if="catalog.length" class="text-xs text-gray-400 ml-1">
      <span class="material-icons align-middle" style="font-size:13px">auto_awesome</span>
      {{ catalog.length }} catalog item{{ catalog.length !== 1 ? 's' : '' }} — click description to search
    </span>
  </div>
</template>
