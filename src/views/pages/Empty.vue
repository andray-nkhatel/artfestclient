<script setup>
import apiClient, { getCategoryById, getCriteria, getJudges, submitScore } from '@/service/api.service';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const store = useStore();

const houseId = route.params.houseId;
const categoryId = route.params.categoryId;

const loading = ref(true);
const error = ref(null);
const house = ref(null);
const category = ref(null);
const criteria = ref([]);
const scores = ref({});
const submitting = ref(false);
const judges = ref([]);

const userRoles = store.getters['auth/userRoles'];
const isAdmin = userRoles && userRoles.includes('Admin');

// Watch for roles to be available before fetching judges
watch(
  () => store.getters['auth/userRoles'],
  (roles) => {
    if (roles && roles.includes('Admin')) {
      fetchJudges();
    }
  },
  { immediate: true }
);

async function fetchJudges() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getJudges();
    judges.value = res.data;
  } catch (err) {
    error.value = err.message || 'Failed to load judges.';
    toast.add({ severity: 'error', summary: 'Error', detail: error.value, life: 5000 });
  } finally {
    loading.value = false;
  }
}

async function fetchData() {
  // Guard for scoring page route params
  if ((router.currentRoute.value.name === 'Scoring') && (!houseId || !categoryId)) {
    error.value = 'Invalid house or category. Please return to the dashboard.';
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    if (router.currentRoute.value.name === 'Scoring') {
      const [houseRes, categoryRes, criteriaRes] = await Promise.all([
        apiClient.get(`/houses/${houseId}`),
        getCategoryById(categoryId),
        getCriteria(),
      ]);
      house.value = houseRes.data;
      category.value = categoryRes.data;
      criteria.value = criteriaRes.data.filter(c => c.categoryId == categoryId);
      criteria.value.forEach(crit => {
        scores.value[crit.id] = '';
      });
    }
  } catch (err) {
    error.value = err.message || 'Failed to load data.';
    toast.add({ severity: 'error', summary: 'Error', detail: error.value, life: 5000 });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});

function validate() {
  for (const crit of criteria.value) {
    const val = scores.value[crit.id];
    if (val === '' || isNaN(val) || val < 0 || val > crit.maxScore) {
      return false;
    }
  }
  return true;
}

async function submitScores() {
  if (!validate()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Please enter valid scores for all criteria.', life: 4000 });
    return;
  }
  submitting.value = true;
  try {
    await submitScore({
      houseId,
      categoryId,
      scores: Object.entries(scores.value).map(([criterionId, value]) => ({ criterionId, value: Number(value) }))
    });
    toast.add({ severity: 'success', summary: 'Success', detail: 'Scores submitted!', life: 3000 });
    router.push('/app/judge-dashboard');
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to submit scores.', life: 5000 });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold mb-4">Admin Dashboard</h1>
    <p v-if="!isAdmin" class="text-red-500">You do not have permission to view this page.</p>
    <template v-else>
      <div v-if="loading" class="flex justify-center items-center h-32">
        <ProgressSpinner />
      </div>
      <div v-else-if="error" class="text-red-500 text-center">{{ error }}</div>
      <div v-else>
        <h2 class="text-xl font-semibold mb-4">Judges</h2>
        <table class="min-w-full border border-gray-300 rounded">
          <thead>
            <tr class="bg-gray-100">
              <th class="px-4 py-2 border">ID</th>
              <th class="px-4 py-2 border">Username</th>
              <th class="px-4 py-2 border">Email</th>
              <th class="px-4 py-2 border">Role</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="judge in judges" :key="judge.id">
              <td class="px-4 py-2 border">{{ judge.id }}</td>
              <td class="px-4 py-2 border">{{ judge.userName || judge.username }}</td>
              <td class="px-4 py-2 border">{{ judge.email }}</td>
              <td class="px-4 py-2 border">{{ judge.role }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
