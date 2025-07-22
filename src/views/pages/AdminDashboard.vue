<script setup>
import { getAllScores, getCategories, getHouses, getJudges } from '@/service/api.service';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
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
const judges = ref([]);
const selectedCategory = ref('');
const selectedHouse = ref('');

// Admin-specific stats
const adminStats = computed(() => {
  const totalHouses = houses.value.length;
  const totalCategories = categories.value.length;
  const totalJudges = judges.value.filter(judge => judge.role === 'Judge').length;
  const totalScores = scores.value.length;
  const totalMarks = scores.value.reduce((sum, score) => {
    return sum + (score.details || []).reduce((detailSum, detail) => detailSum + detail.mark, 0);
  }, 0);
  
  // Calculate average score across all houses and categories
  const totalCriteria = scores.value.reduce((sum, score) => sum + (score.details || []).length, 0);
  const averageScore = totalCriteria > 0 ? (totalMarks / totalCriteria).toFixed(2) : '0.00';
  
  return {
    totalHouses,
    totalCategories,
    totalJudges,
    totalScores,
    totalMarks,
    averageScore
  };
});

// House rankings based on total marks
const houseRankings = computed(() => {
  const rankings = {};
  
  houses.value.forEach(house => {
    rankings[house.id] = {
      id: house.id,
      name: house.name,
      totalMarks: 0,
      categories: new Set(),
      averageScore: 0,
      marksCount: 0
    };
  });
  
  scores.value.forEach(score => {
    const ranking = rankings[score.houseId];
    if (ranking) {
      let sum = 0;
      let count = 0;
      (score.details || []).forEach(detail => {
        sum += detail.mark;
        count++;
      });
      ranking.totalMarks += sum;
      ranking.marksCount += count;
      ranking.categories.add(score.categoryId);
    }
  });
  
  // Calculate averages and convert to array
  Object.values(rankings).forEach(ranking => {
    ranking.averageScore = ranking.marksCount > 0 ? (ranking.totalMarks / ranking.marksCount).toFixed(2) : '0.00';
    ranking.categoriesCount = ranking.categories.size;
  });
  
  // Sort by total marks (descending)
  return Object.values(rankings).sort((a, b) => b.totalMarks - a.totalMarks);
});

// Judge rankings based on average scores
const judgeRankings = computed(() => {
  const rankings = {};
  
  judges.value.filter(judge => judge.role === 'Judge').forEach(judge => {
    rankings[judge.id] = {
      id: judge.id,
      name: judge.name || `Judge ${judge.id}`,
      totalMarks: 0,
      averageScore: 0,
      marksCount: 0,
      housesScored: new Set(),
      categoriesScored: new Set()
    };
  });
  
  scores.value.forEach(score => {
    const ranking = rankings[score.judgeId];
    if (ranking) {
      let sum = 0;
      let count = 0;
      (score.details || []).forEach(detail => {
        sum += detail.mark;
        count++;
      });
      ranking.totalMarks += sum;
      ranking.marksCount += count;
      ranking.housesScored.add(score.houseId);
      ranking.categoriesScored.add(score.categoryId);
    }
  });
  
  // Calculate averages and convert to array
  Object.values(rankings).forEach(ranking => {
    ranking.averageScore = ranking.marksCount > 0 ? (ranking.totalMarks / ranking.marksCount).toFixed(2) : '0.00';
    ranking.housesCount = ranking.housesScored.size;
    ranking.categoriesCount = ranking.categoriesScored.size;
  });
  
  // Sort by average score (descending)
  return Object.values(rankings).sort((a, b) => parseFloat(b.averageScore) - parseFloat(a.averageScore));
});

// Category rankings based on average scores
const categoryRankings = computed(() => {
  const rankings = {};
  
  categories.value.forEach(category => {
    rankings[category.id] = {
      id: category.id,
      name: category.name,
      totalMarks: 0,
      averageScore: 0,
      marksCount: 0,
      housesParticipated: new Set(),
      judgesParticipated: new Set()
    };
  });
  
  scores.value.forEach(score => {
    const ranking = rankings[score.categoryId];
    if (ranking) {
      let sum = 0;
      let count = 0;
      (score.details || []).forEach(detail => {
        sum += detail.mark;
        count++;
      });
      ranking.totalMarks += sum;
      ranking.marksCount += count;
      ranking.housesParticipated.add(score.houseId);
      ranking.judgesParticipated.add(score.judgeId);
    }
  });
  
  // Calculate averages and convert to array
  Object.values(rankings).forEach(ranking => {
    ranking.averageScore = ranking.marksCount > 0 ? (ranking.totalMarks / ranking.marksCount).toFixed(2) : '0.00';
    ranking.housesCount = ranking.housesParticipated.size;
    ranking.judgesCount = ranking.judgesParticipated.size;
  });
  
  // Sort by average score (descending)
  return Object.values(rankings).sort((a, b) => parseFloat(b.averageScore) - parseFloat(a.averageScore));
});

// Flattened scores for table display
const tableScores = computed(() => {
  const houseMap = Object.fromEntries(houses.value.map(h => [h.id, h.name]));
  const categoryMap = Object.fromEntries(categories.value.map(c => [c.id, c.name]));
  const judgeMap = Object.fromEntries(judges.value.map(j => [j.id, j.name || `Judge ${j.id}`]));
  const criteriaMap = {};
  categories.value.forEach(cat => {
    (cat.criteria || []).forEach(crit => {
      criteriaMap[crit.id] = { name: crit.name, maxMark: crit.maxMark };
    });
  });
  
  return scores.value.flatMap(score => {
    if (selectedCategory.value && score.categoryId != selectedCategory.value) return [];
    if (selectedHouse.value && score.houseId != selectedHouse.value) return [];
    return (score.details || []).map(detail => ({
      houseName: houseMap[score.houseId] || score.houseId,
      categoryName: categoryMap[score.categoryId] || score.categoryId,
      criterionName: criteriaMap[detail.criterionId]?.name || detail.criterionId,
      value: detail.mark,
      maxScore: criteriaMap[detail.criterionId]?.maxMark || '',
      judgeName: judgeMap[score.judgeId] || `Judge ${score.judgeId}`,
      judgeId: score.judgeId,
      _raw: { score, detail }
    }));
  });
});

async function fetchScores() {
  loading.value = true;
  error.value = null;
  try {
    console.log('Fetching all scores from API...');
    const res = await getAllScores();
    console.log('API Response:', res);
    console.log('Response data:', res.data);
    scores.value = res.data;
    console.log('Scores set to component:', scores.value);
  } catch (err) {
    console.error('Error fetching all scores:', err);
    console.error('Error response:', err.response);
    error.value = err.message || 'Failed to load scores.';
    toast.add({ severity: 'error', summary: 'Error', detail: error.value, life: 5000 });
  } finally {
    loading.value = false;
  }
}

async function fetchLists() {
  try {
    const [catRes, houseRes, judgesRes] = await Promise.all([
      getCategories(),
      getHouses(),
      getJudges(),
    ]);
    categories.value = catRes.data;
    houses.value = houseRes.data;
    judges.value = judgesRes.data;
    console.log('Lists fetched:', { categories: categories.value, houses: houses.value, judges: judges.value });
  } catch (err) {
    console.error('Error fetching lists:', err);
    houses.value = [];
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load houses, categories, or judges.', life: 5000 });
  }
}

onMounted(async () => {
  await fetchLists();
  await fetchScores();
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">Admin Dashboard</h1>
    
    <div v-if="loading" class="flex justify-center items-center h-32">
      <ProgressSpinner />
    </div>
    
    <div v-else-if="error" class="text-red-500 text-center">{{ error }}</div>
    
    <div v-else>
      <!-- Overview Stats -->
      <div class="mb-8">
        <h2 class="text-xl font-semibold mb-4">Overview</h2>
        <div class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ adminStats.totalHouses }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Total Houses</div>
          </div>
          <div class="bg-green-50 dark:bg-green-900 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ adminStats.totalCategories }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Categories</div>
          </div>
          <div class="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ adminStats.totalJudges }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Judges</div>
          </div>
          <div class="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
            <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ adminStats.totalScores }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Score Submissions</div>
          </div>
          <div class="bg-orange-50 dark:bg-orange-900 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
            <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ adminStats.totalMarks }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Total Marks</div>
          </div>
          <div class="bg-red-50 dark:bg-red-900 p-4 rounded-lg border border-red-200 dark:border-red-700">
            <div class="text-2xl font-bold text-red-600 dark:text-red-400">{{ adminStats.averageScore }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-300">Average Score</div>
          </div>
        </div>
      </div>

      <!-- House Rankings -->
      <div class="mb-8">
        <h2 class="text-xl font-semibold mb-4">House Rankings</h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <DataTable :value="houseRankings" class="p-datatable-sm">
            <Column field="name" header="House" sortable></Column>
            <Column field="totalMarks" header="Total Marks" sortable></Column>
            <Column field="averageScore" header="Average Score" sortable></Column>
            <Column field="categoriesCount" header="Categories" sortable></Column>
            <Column header="Rank" :exportable="false">
              <template #body="slotProps">
                <span class="font-bold text-lg">{{ slotProps.index + 1 }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- Judge Rankings -->
      <div class="mb-8">
        <h2 class="text-xl font-semibold mb-4">Judge Rankings (by Average Score)</h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <DataTable :value="judgeRankings" class="p-datatable-sm">
            <Column field="name" header="Judge" sortable></Column>
            <Column field="averageScore" header="Average Score" sortable></Column>
            <Column field="totalMarks" header="Total Marks" sortable></Column>
            <Column field="marksCount" header="Marks Given" sortable></Column>
            <Column field="housesCount" header="Houses Scored" sortable></Column>
            <Column field="categoriesCount" header="Categories" sortable></Column>
            <Column header="Rank" :exportable="false">
              <template #body="slotProps">
                <span class="font-bold text-lg">{{ slotProps.index + 1 }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- Category Rankings -->
      <div class="mb-8">
        <h2 class="text-xl font-semibold mb-4">Category Rankings (by Average Score)</h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <DataTable :value="categoryRankings" class="p-datatable-sm">
            <Column field="name" header="Category" sortable></Column>
            <Column field="averageScore" header="Average Score" sortable></Column>
            <Column field="totalMarks" header="Total Marks" sortable></Column>
            <Column field="marksCount" header="Total Marks Given" sortable></Column>
            <Column field="housesCount" header="Houses Participated" sortable></Column>
            <Column field="judgesCount" header="Judges Participated" sortable></Column>
            <Column header="Rank" :exportable="false">
              <template #body="slotProps">
                <span class="font-bold text-lg">{{ slotProps.index + 1 }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- All Scores Table -->
      <div class="mb-8">
        <h2 class="text-xl font-semibold mb-4">All Submitted Scores</h2>
        
        <!-- Filters -->
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
        
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <DataTable :value="tableScores" :paginator="true" :rows="10" :rowsPerPageOptions="[5, 10, 25]" class="p-datatable-sm">
            <Column field="houseName" header="House" sortable></Column>
            <Column field="categoryName" header="Category" sortable></Column>
            <Column field="criterionName" header="Criterion" sortable></Column>
            <Column field="value" header="Score" sortable></Column>
            <Column field="maxScore" header="Max Score" sortable></Column>
            <Column field="judgeName" header="Judge" sortable></Column>
          </DataTable>
        </div>
        
        <div v-if="tableScores.length === 0" class="text-gray-500 mt-4">No scores submitted yet.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any custom styles here */
</style> 