<script setup>
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref } from 'vue';
import apiClient from '../../service/api.service';

const toast = useToast();
const results = ref([]);
const loading = ref(true);
const error = ref(null);
const selectedResults = ref(null);
let pollingInterval = null;

// Data for participant and event information
const participants = ref([]);
const events = ref([]);

// Helper functions for getting related data
const getHouseNameForParticipant = (participantId) => {
  const participant = participants.value.find(p => p.value === participantId);
  return participant ? participant.houseName : 'N/A';
};

const getCategoryNameForEvent = (eventId) => {
  const event = events.value.find(e => e.value === eventId);
  return event ? event.categoryName : 'N/A';
};

// Load participants data (needed for the house name lookup)
const loadParticipants = () => {
  apiClient.get('/participants')
    .then(response => {
      participants.value = response.data.map(participant => ({
        label: participant.fullName,
        value: participant.id,
        name: participant.fullName,
        houseName: participant.houseName,
        houseId: participant.houseId
      }));
    })
    .catch(err => {
      console.error('Error loading participants:', err);
      toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load participants', life: 3000 });
    });
};

// Load events data (needed for the category name lookup)
const loadEvents = () => {
  apiClient.get('/events')
    .then(response => {
      events.value = response.data.map(event => ({
        label: event.name,
        value: event.id,
        name: event.name,
        categoryId: event.categoryId,
        categoryName: event.categoryName,
      }));
    })
    .catch(err => {
      console.error('Error loading events:', err);
      toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load events', life: 3000 });
    });
};

// Fetch results data
const fetchResults = () => {
  loading.value = true;
  error.value = null;
  
  apiClient.get('/results')
    .then(response => {
      results.value = response.data;
      console.log('Results loaded:', results.value);
    })
    .catch(err => {
      console.error('Error fetching results:', err);
      error.value = 'Failed to load results. Please try again later.';
      toast.add({ severity: 'error', summary: 'Error', detail: error.value, life: 3000 });
    })
    .finally(() => {
      loading.value = false;
    });
};

// Load data on component mount
onMounted(() => {
  fetchResults();
  loadParticipants();
  loadEvents();
  pollingInterval = setInterval(fetchResults,60000);
});

onUnmounted(()=>{
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
});
</script>

<template>
  <div class="results-table-component">
    <!-- Data Table -->
    <DataTable 
      :value="results" 
      v-model:selection="selectedResults" 
      dataKey="id"
      :paginator="true" 
      :rows="100"
      :rowsPerPageOptions="[5, 10, 25]"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
      currentPageReportTemplate="Showing {first} to {last} of {totalRecords} results"
      responsiveLayout="scroll"
      :loading="loading"
      stripedRows
      :filters="null"
      class="p-datatable-sm"
      :showGridlines="true"
    >
      <template #empty>
        <div class="text-center p-4" v-if="!loading && !error">
          No results found.
        </div>
        <div class="text-center text-red-500 p-4" v-if="error">
          {{ error }}
        </div>
      </template>
      
      <!-- <Column field="id" header="ID" sortable style="width: 4rem"></Column> -->
      <Column field="participantName" header="Name" sortable style="min-width: 1rem"></Column>
      <Column field="position" header="Position" sortable style="width: 1rem; text-align: center;">
      <Column field="eventName" header="Event" sortable style="width: 1rem;text-align: center;"></Column>

        <template #body="slotProps">
          <span :class="{'text-green-600 font-bold': slotProps.data.position === 1, 
                       'text-blue-600 font-bold': slotProps.data.position === 2,
                       'text-orange-600 font-bold': slotProps.data.position === 3}">
            {{ slotProps.data.position }}
          </span>
        </template>
      </Column>
      <Column field="houseName" header="House" sortable style="width: 1em; text-align: center;">
        <template #body="slotProps">
          <span>{{ getHouseNameForParticipant(slotProps.data.participantId) }}</span>
        </template>
      </Column>
      <Column field="eventName" header="" sortable style="min-width: none; text-align: center;">
        <template #header>
          <div class="flex text-center justify-center w-full">Event</div>
        </template>
      </Column>
      <Column field="categoryName" header="Category" sortable style="width: 1rem; text-align: center;">
        <template #body="slotProps">
          <span>{{ getCategoryNameForEvent(slotProps.data.eventId) }}</span>
        </template>
      </Column>
      <Column field="points" header="Points" sortable style="width: 1rem; text-align: center;"></Column>
    </DataTable>
  </div>
</template>

<style scoped>
.results-table-component {
  margin-top: 1.5rem;
  background-color: var(--surface-card);
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>