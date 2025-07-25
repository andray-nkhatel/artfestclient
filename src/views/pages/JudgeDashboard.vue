<script setup>
import { deleteScore, getCategories, getHouses, getMyScores, submitScore, updateScore } from '@/service/api.service';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
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

const tableScores = computed(() => {
  // Helper maps for quick lookup
  const houseMap = Object.fromEntries(houses.value.map(h => [h.id, h.name]));
  const categoryMap = Object.fromEntries(categories.value.map(c => [c.id, c.name]));
  // Build a map of criterionId to { name, maxMark }
  const criteriaMap = {};
  categories.value.forEach(cat => {
    (cat.criteria || []).forEach(crit => {
      criteriaMap[crit.id] = { name: crit.name, maxMark: crit.maxMark };
    });
  });
  // Flatten scores
  return scores.value.flatMap(score => {
    // Filter by selected category/house
    if (selectedCategory.value && score.categoryId != selectedCategory.value) return [];
    if (selectedHouse.value && score.houseId != selectedHouse.value) return [];
    return (score.details || []).map(detail => ({
      houseName: houseMap[score.houseId] || score.houseId,
      categoryName: categoryMap[score.categoryId] || score.categoryId,
      criterionName: criteriaMap[detail.criterionId]?.name || detail.criterionId,
      value: detail.mark,
      maxScore: criteriaMap[detail.criterionId]?.maxMark || '',
      // Optionally include the original objects for edit/delete
      _raw: { score, detail }
    }));
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
    console.log('Criteria data:', entryCriteria.value); // Debug log
    entryScores.value = {};
    entryCriteria.value.forEach(crit => {
      entryScores.value[crit.id] = 0;
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
    if (val === '' || isNaN(val) || val < 0 || val > crit.maxMark) {
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
  const payload = {
    houseId: entryHouse.value.id,
    categoryId: entryCategory.value.id,
    Details: Object.entries(entryScores.value).map(([criterionId, value]) => ({
      criterionId,
      mark: Number(value)
    })),
    request: ""
  };
  console.log('Submitting payload:', payload);
  try {
    await submitScore(payload);
    toast.add({ severity: 'success', summary: 'Scores submitted', detail: 'Scores submitted successfully', life: 3000 });
    showEntryDialog.value = false;
    await fetchScores();
  } catch (err) {
    console.log('Error data:', err.response?.data?.errors || err);
    toast.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to submit scores.', life: 5000 });
  } finally {
    entryLoading.value = false;
  }
}

// Add computed stats for each house
const houseStats = computed(() => {
  // Build a map: houseId -> { totalScores, avgScore, categoriesCount }
  const stats = {};
  houses.value.forEach(house => {
    stats[house.id] = { totalScores: 0, avgScore: 0, categories: new Set() };
  });
  scores.value.forEach(score => {
    const stat = stats[score.houseId];
    if (stat) {
      let sum = 0;
      let count = 0;
      (score.details || []).forEach(detail => {
        sum += detail.mark;
        count++;
      });
      stat.totalScores += count;
      stat.avgScore += sum;
      stat.categories.add(score.categoryId);
    }
  });
  // Finalize average
  Object.values(stats).forEach(stat => {
    stat.avgScore = stat.totalScores ? (stat.avgScore / stat.totalScores).toFixed(2) : '0.00';
    stat.categoriesCount = stat.categories.size;
  });
  return stats;
});

// Compute judged houses per category for the current judge
const judgedHouseCategorySet = computed(() => {
  const set = new Set();
  scores.value.forEach(score => {
    set.add(`${score.houseId}-${score.categoryId}`);
  });
  return set;
});

// House rankings by category (for judge view)
const houseRankingsByCategory = computed(() => {
  const rankingsByCategory = {};
  
  // Initialize rankings for each category
  categories.value.forEach(category => {
    rankingsByCategory[category.id] = {
      categoryId: category.id,
      categoryName: category.name,
      houseRankings: []
    };
  });
  
  // Calculate house scores for each category
  houses.value.forEach(house => {
    categories.value.forEach(category => {
      const categoryScores = scores.value.filter(score => 
        score.houseId === house.id && score.categoryId === category.id
      );
      
      if (categoryScores.length > 0) {
        let totalMarks = 0;
        let totalCriteria = 0;
        let judgesCount = new Set();
        
        categoryScores.forEach(score => {
          (score.details || []).forEach(detail => {
            totalMarks += detail.mark;
            totalCriteria++;
          });
          judgesCount.add(score.judgeId);
        });
        
        const averageScore = totalCriteria > 0 ? (totalMarks / totalCriteria).toFixed(2) : '0.00';
        
        rankingsByCategory[category.id].houseRankings.push({
          houseId: house.id,
          houseName: house.name,
          totalMarks: totalMarks,
          averageScore: averageScore,
          criteriaCount: totalCriteria,
          judgesCount: judgesCount.size
        });
      }
    });
  });
  
  // Sort house rankings within each category by average score (descending)
  Object.values(rankingsByCategory).forEach(category => {
    category.houseRankings.sort((a, b) => parseFloat(b.averageScore) - parseFloat(a.averageScore));
  });
  
  return rankingsByCategory;
});

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
    <!-- <div>
      Categories: {{ categories.length }}<br>
      Houses: {{ houses.length }}
    </div> -->
    <div v-if="loading" class="flex justify-center items-center h-32">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="text-red-500 text-center">{{ error }}</div>
    <div v-else>
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Submit New Scores</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
          <Panel v-for="category in categories" :key="category.id" >
            <template #header>
                <h5>{{ category.name }}</h5>
            </template>
            <!-- <h3 class="text-lg font-semibold mb-2">{{ category.name }}</h3> -->
            <div class="mb-2 text-gray-600">{{ category.description }}</div>
            <div>
              <div class="flex flex-col items-center gap-2">
                <div v-for="house in houses" :key="house.id">
                  <Button
                    :class="[
                      'p-button-md w-full  mb-2',
                      house.name === 'Kudu' ? 'p-button-danger' : 'p-button-primary',
                      judgedHouseCategorySet.has(`${house.id}-${category.id}`) ? 'opacity-60 cursor-not-allowed' : ''
                    ]"
                    :style="house.name === 'Eland' ? 'background-color: #ffe600; color: #000; border-color: #ffe600;' : ''"
                    :disabled="judgedHouseCategorySet.has(`${house.id}-${category.id}`)"
                    @click="!judgedHouseCategorySet.has(`${house.id}-${category.id}`) && openEntryDialog(house, category)"
                  >
                    {{ house.name }}
                    <span v-if="judgedHouseCategorySet.has(`${house.id}-${category.id}`)" class="ml-2 text-xs text-green-700 font-semibold">Judged</span>
                  </Button>
                </div>
              </div>
            </div>
        </Panel>
        </div>
      </div>
      <div v-if="houses.length" class="mb-8">
        <h2 class="text-xl font-semibold mb-2">All Houses</h2>
        <div class="grid grid-cols-1 md:grid-cols-3  gap-6">
          <Panel v-for="house in houses" :key="house.id">
            <template #header>
              <span class="font-bold">{{ house.name }}</span>
            </template>
            <div class="text-sm text-gray-600">
              <div>Total Scores: <span class="font-semibold">{{ houseStats[house.id]?.totalScores || 0 }}</span></div>
              <div>Average Score: <span class="font-semibold">{{ houseStats[house.id]?.avgScore || '0.00' }}</span></div>
              <div>Categories: <span class="font-semibold">{{ houseStats[house.id]?.categoriesCount || 0 }}</span></div>
            </div>
          </Panel>
        </div>
      </div>
      
      <!-- House Rankings by Category -->
      <div class="mb-8">
        <h2 class="text-xl font-semibold mb-4">House Rankings by Category</h2>
        <div v-for="category in Object.values(houseRankingsByCategory)" :key="category.categoryId" class="mb-6">
          <h3 class="text-lg font-medium mb-3 text-gray-700 dark:text-gray-300">{{ category.categoryName }}</h3>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <DataTable :value="category.houseRankings" class="p-datatable-sm">
              <Column field="houseName" header="House" sortable></Column>
              <Column field="averageScore" header="Average Score" sortable></Column>
              <Column field="totalMarks" header="Total Marks" sortable></Column>
              <Column field="criteriaCount" header="Criteria Count" sortable></Column>
              <Column field="judgesCount" header="Judges Count" sortable></Column>
              <Column header="Rank" :exportable="false">
                <template #body="slotProps">
                  <span class="font-bold text-lg">{{ slotProps.index + 1 }}</span>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </div>
      
      <!-- <div class="mb-4 flex gap-4 items-center">
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
      </div> -->
      <h2 class="text-xl font-semibold mb-4">My Submitted Scores</h2>
      <DataTable :value="tableScores" stripedRows :paginator="true" :rows="10" :rowsPerPageOptions="[5, 10, 25]" class="p-datatable-sm">
        <Column field="houseName" header="House" sortable></Column>
        <Column field="categoryName" header="Category" sortable></Column>
        <Column field="criterionName" header="Criterion" sortable></Column>
        <Column field="value" header="Score"></Column>
        <!-- <Column field="maxScore" header="Max Score" sortable></Column> -->
      </DataTable>
      <div v-if="tableScores.length === 0" class="text-gray-500 mt-4">No scores submitted yet.</div>
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
      <Dialog v-model:visible="showEntryDialog" :header="entryHouse ? `Submit Scores for ${entryHouse.name}` : 'Submit Scores'" :modal="true" :closable="true" :style="{ width: '400px' }">
        <div v-if="entryLoading" class="flex justify-center items-center h-24">
          <ProgressSpinner />
        </div>
        <div v-else-if="entryCriteria.length === 0" class="text-gray-500">No criteria found for this category.</div>
        <div v-else class="flex flex-col gap-4">
          <div v-for="crit in entryCriteria" :key="crit.id" class="flex flex-col gap-1">
            <label>{{ crit.name }}</label>
            <div class="flex items-center gap-2">
              <Slider v-model="entryScores[crit.id]" :min="0" :max="crit.maxMark || 10"  class="w-full" />
              <span class="text-xs text-gray-500">{{ entryScores[crit.id] }}</span>
              <!-- <span class="text-xs text-gray-500">{{ crit.maxMark || 'N/A' }}</span> -->
            </div>
            <div class="flex flex-row justify-between mt-1 text-xs text-gray-400">
              <!-- <span v-for="n in (crit.maxMark || 10) + 1" :key="n-1">{{ n-1 }}</span> -->
            </div>
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