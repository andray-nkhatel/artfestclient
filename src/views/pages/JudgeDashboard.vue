<script setup>
import { deleteScore, getCategories, getHouses, getMyScores, submitScore, updateScore } from '@/service/api.service';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const toast = useToast();
const router = useRouter();

const loading = ref(true);
const error = ref(null);
const scores = ref([]);
const categories = ref([]);
const houses = ref([]);
const selectedCategory = ref('');
const selectedHouse = ref('');

const showEditDialog = ref(false);
const editScore = ref(null);
const editValue = ref(0);

const showEntryDialog = ref(false);
const entryCategory = ref(null);
const entryHouse = ref(null);
const entryCriteria = ref([]);
const entryScores = ref({});
const entryLoading = ref(false);

async function fetchScores() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getMyScores();
    scores.value = res.data;
  } catch (err) {
    error.value = err.message || 'Failed to load your scores.';
    toast.add({ severity: 'error', summary: 'Error', detail: error.value, life: 5000 });
  } finally {
    loading.value = false;
  }
}

async function fetchLists() {
  try {
    const [catRes, houseRes] = await Promise.all([
      getCategories(),
      getHouses(),
    ]);
    categories.value = catRes.data;
    houses.value = houseRes.data;
  } catch (err) {
    houses.value = [];
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load houses or categories.', life: 5000 });
  }
}

function goToScoring(houseId, categoryId) {
  router.push({ name: 'Scoring', params: { houseId, categoryId } });
}

const filteredScores = computed(() => {
  return scores.value.filter(score => {
    const matchCategory = selectedCategory.value ? score.categoryId == selectedCategory.value : true;
    const matchHouse = selectedHouse.value ? score.houseId == selectedHouse.value : true;
    return matchCategory && matchHouse;
  });
});

function openEditDialog(score) {
  editScore.value = score;
  editValue.value = score.value;
  showEditDialog.value = true;
}

async function saveEdit() {
  try {
    await updateScore(editScore.value.id, { value: editValue.value });
    toast.add({ severity: 'success', summary: 'Score updated', detail: 'Score updated successfully', life: 3000 });
    showEditDialog.value = false;
    await fetchScores();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to update score.', life: 5000 });
  }
}

async function deleteScoreAction(score) {
  try {
    await deleteScore(score.id);
    toast.add({ severity: 'success', summary: 'Score deleted', detail: 'Score deleted successfully', life: 3000 });
    await fetchScores();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to delete score.', life: 5000 });
  }
}

async function openEntryDialog(house, category) {
  entryCategory.value = category;
  entryHouse.value = house;
  entryLoading.value = true;
  showEntryDialog.value = true;
  try {
    entryCriteria.value = category.criteria || [];
    entryScores.value = {};
    entryCriteria.value.forEach(crit => {
      entryScores.value[crit.id] = '';
    });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load criteria.', life: 5000 });
    showEntryDialog.value = false;
  } finally {
    entryLoading.value = false;
  }
}

function validateEntry() {
  for (const crit of entryCriteria.value) {
    const val = entryScores.value[crit.id];
    if (val === '' || isNaN(val) || val < 0 || val > crit.maxScore) {
      return false;
    }
  }
  return true;
}

async function submitEntryScores() {
  if (!validateEntry()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Please enter valid scores for all criteria.', life: 4000 });
    return;
  }
  entryLoading.value = true;
  try {
    await submitScore({
      houseId: entryHouse.value.id,
      categoryId: entryCategory.value.id,
      scores: Object.entries(entryScores.value).map(([criterionId, value]) => ({ criterionId, value: Number(value) }))
    });
    toast.add({ severity: 'success', summary: 'Scores submitted', detail: 'Scores submitted successfully', life: 3000 });
    showEntryDialog.value = false;
    await fetchScores();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to submit scores.', life: 5000 });
  } finally {
    entryLoading.value = false;
  }
}

onMounted(async () => {
  //console.log("Fetching houses");

  // const respond = await getHouses();

  //console.log(respond);
  await fetchLists();
  
  await fetchScores();
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">Judge Dashboard</h1>
    <div>
      Categories: {{ categories.length }}<br>
      Houses: {{ houses.length }}
    </div>
    <div v-if="loading" class="flex justify-center items-center h-32">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="text-red-500 text-center">{{ error }}</div>
    <div v-else>
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Submit New Scores</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Panel v-for="category in categories" :key="category.id" >
            <template #header>
                <h5>{{ category.name }}</h5>
            </template>
            <!-- <h3 class="text-lg font-semibold mb-2">{{ category.name }}</h3> -->
            <div class="mb-2 text-gray-600">{{ category.description }}</div>
            <div>
              <div class="flex flex-col justify-center items-center gap-2 ml-2">
                <div v-for="house in houses" :key="house.id">
                  <Button class="p-button-md p-button-primary  mb-2" @click="openEntryDialog(house, category)">{{ house.name }}</Button>
                  <Button label="Go to Page"  class="ml-8 p-button-md p-button-secondary" @click="goToScoring(house.id, category.id)" />
                </div>
              </div>
            </div>
        </Panel>
        </div>
      </div>
      <div v-if="houses.length" class="mb-8">
        <h2 class="text-xl font-semibold mb-2">All Houses</h2>
        <div class="grid grid-cols-1 md:grid-cols-3  gap-6">
          <!-- <div v-for="house in houses" :key="house.id" class="card shadow p-4 rounded-lg bg-white dark:bg-surface-900 flex items-center justify-center text-lg font-semibold">
            {{ house.name }}
          </div> -->

          <Panel  v-for="house in houses">
            {{ house.name }}
          </Panel>

        </div>
      </div>
      <div class="mb-4 flex gap-4 items-center">
        <label>Filter by Category:</label>
        <select v-model="selectedCategory" class="border rounded px-2 py-1">
          <option value="">All</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
        <label>Filter by House:</label>
        <select v-model="selectedHouse" class="border rounded px-2 py-1">
          <option value="">All</option>
          <option v-for="house in houses" :key="house.id" :value="house.id">{{ house.name }}</option>
        </select>
      </div>
      <h2 class="text-xl font-semibold mb-4">My Submitted Scores</h2>
      <DataTable :value="filteredScores" :paginator="true" :rows="10" :rowsPerPageOptions="[5, 10, 25]" class="p-datatable-sm">
        <Column field="houseName" header="House" sortable></Column>
        <Column field="categoryName" header="Category" sortable></Column>
        <Column field="criterionName" header="Criterion" sortable></Column>
        <Column field="value" header="Score" sortable></Column>
        <Column field="maxScore" header="Max Score" sortable></Column>
        <Column header="Actions" :exportable="false">
          <template #body="slotProps">
            <Button icon="pi pi-pencil" class="p-button-text p-button-sm mr-2" @click="openEditDialog(slotProps.data)" />
            <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" @click="deleteScoreAction(slotProps.data)" />
          </template>
        </Column>
      </DataTable>
      <div v-if="filteredScores.length === 0" class="text-gray-500 mt-4">No scores submitted yet.</div>
      <Dialog v-model:visible="showEditDialog" header="Edit Score" :modal="true" :closable="true" :style="{ width: '350px' }">
        <div class="flex flex-col gap-4">
          <label>Score</label>
          <InputNumber v-model="editValue" :min="0" :max="editScore?.maxScore" class="w-full" />
          <div class="flex justify-end gap-2 mt-4">
            <Button label="Cancel" @click="showEditDialog = false" class="p-button-text" />
            <Button label="Save" @click="saveEdit" class="p-button-primary" />
          </div>
        </div>
      </Dialog>
      <Dialog v-model:visible="showEntryDialog" header="Submit Scores" :modal="true" :closable="true" :style="{ width: '400px' }">
        <div v-if="entryLoading" class="flex justify-center items-center h-24">
          <ProgressSpinner />
        </div>
        <div v-else-if="entryCriteria.length === 0" class="text-gray-500">No criteria found for this category.</div>
        <div v-else class="flex flex-col gap-4">
          <div v-for="crit in entryCriteria" :key="crit.id" class="flex flex-col gap-1">
            <label>{{ crit.name }} <span class="text-xs text-gray-400">(Max: {{ crit.maxScore }})</span></label>
            <InputNumber v-model="entryScores[crit.id]" :min="0" :max="crit.maxScore" class="w-full" />
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <Button label="Cancel" @click="showEntryDialog = false" class="p-button-text" />
            <Button label="Submit" @click="submitEntryScores" class="p-button-primary" :disabled="entryLoading" />
          </div>
        </div>
      </Dialog>
    </div>
  </div>
</template> 