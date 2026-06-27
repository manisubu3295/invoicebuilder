<script setup>
import { computed } from 'vue';

const props = defineProps({ modelValue: Array });
const emit = defineEmits(['update:modelValue']);

const items = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

function addRow(type = 'service') {
  items.value = [...items.value, {
    sno: items.value.length + 1, itemType: type, jobDescription: '',
    fromDate: '', toDate: '', rate: '', rateType: 'per_week',
    deliveryDate: '', quantity: 1, unitPrice: '', totalAmount: 0,
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
  else if (field === 'itemType') updated[i].totalAmount = 0;
  else updated[i].totalAmount = calcTotal(updated[i]);
  items.value = updated;
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
        <tr v-for="(item, i) in items" :key="i" class="border-b border-gray-100 hover:bg-gray-50"
            :class="item.itemType === 'delivery' ? 'bg-blue-50/30' : ''">
          <td class="px-2 py-2 text-center border-r border-gray-100">
            <div class="text-gray-400 text-xs leading-none">{{ item.sno }}</div>
            <button @click="updateItem(i,'itemType', item.itemType==='delivery'?'service':'delivery')"
              class="text-[10px] font-bold px-1 rounded mt-1"
              :class="item.itemType==='delivery' ? 'text-blue-700 bg-blue-100' : 'text-gray-500 bg-gray-100'"
              :title="item.itemType==='delivery' ? 'Switch to Service' : 'Switch to Delivery'">
              {{ item.itemType === 'delivery' ? 'DEL' : 'SVC' }}
            </button>
          </td>
          <td class="px-2 py-2 border-r border-gray-100">
            <input :value="item.jobDescription" @input="updateItem(i,'jobDescription',$event.target.value)"
              :class="inputCls" :placeholder="item.itemType==='delivery' ? 'e.g. Milk, Rice…' : 'e.g. Lorry hire'"/>
          </td>
          <td class="px-2 py-2 border-r border-gray-100">
            <input v-if="item.itemType !== 'delivery'" type="date" :value="item.fromDate"
              @input="updateItem(i,'fromDate',$event.target.value)" :class="inputCls + ' text-xs'"/>
            <input v-else type="date" :value="item.deliveryDate"
              @input="updateItem(i,'deliveryDate',$event.target.value)" :class="inputCls + ' text-xs'"/>
          </td>
          <td class="px-2 py-2 border-r border-gray-100">
            <input v-if="item.itemType !== 'delivery'" type="date" :value="item.toDate"
              @input="updateItem(i,'toDate',$event.target.value)" :class="inputCls + ' text-xs'"/>
            <span v-else class="text-gray-300 text-xs px-1">—</span>
          </td>
          <td class="px-2 py-2 border-r border-gray-100">
            <input type="number" :value="item.itemType==='delivery' ? item.unitPrice : item.rate"
              @input="updateItem(i, item.itemType==='delivery' ? 'unitPrice' : 'rate', $event.target.value)"
              :class="inputCls + ' text-right'" placeholder="0.00"/>
          </td>
          <td class="px-2 py-2 border-r border-gray-100">
            <select v-if="item.itemType !== 'delivery'" :value="item.rateType"
              @change="updateItem(i,'rateType',$event.target.value)"
              class="w-full bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-0.5">
              <option value="per_week">Per Week</option>
              <option value="per_day">Per Day</option>
            </select>
            <input v-else type="number" :value="item.quantity"
              @input="updateItem(i,'quantity',$event.target.value)"
              :class="inputCls + ' text-right'" placeholder="Qty" min="0" step="0.001"/>
          </td>
          <td class="px-2 py-2 border-r border-gray-100">
            <input type="number" :value="item.totalAmount"
              @input="updateItem(i,'totalAmount',$event.target.value)"
              :class="inputCls + ' text-right font-semibold'" placeholder="0.00"/>
          </td>
          <td class="px-1 py-2 text-center">
            <button @click="removeRow(i)" class="text-gray-300 hover:text-red-500 text-lg leading-none font-bold">×</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="flex gap-2 mt-3">
    <button @click="addRow('service')" class="btn-secondary text-xs h-7 px-3">+ Service</button>
    <button @click="addRow('delivery')" class="text-xs h-7 px-3 border border-blue-300 text-blue-700 bg-blue-50 rounded hover:bg-blue-100 font-medium uppercase tracking-wide">+ Delivery</button>
  </div>
</template>
