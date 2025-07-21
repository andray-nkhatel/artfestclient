




<template>
    <div class="results-mobile-list">
      <div
        v-for="result in results"
        :key="result.id"
        class="result-card"
      >
        <div class="result-main">
          <div class="result-field"><b>Participant:</b> {{ result.participantName }}</div>
          <div class="result-field"><b>Event:</b> {{ result.eventName }}</div>
          <div class="result-field"><b>Position:</b> {{ result.position }}</div>
          <div class="result-field"><b>House:</b> {{ getHouseNameForParticipant(result.participantId) }}</div>
          <div class="result-field"><b>Category:</b> {{ getCategoryNameForEvent(result.eventId) }}</div>
          <div class="result-field"><b>Points:</b> {{ result.points }}</div>
        </div>
        <div class="result-actions">
          <Button icon="pi pi-pencil" class="p-button-rounded p-button-success mr-2" @click="$emit('edit', result)" />
          <Button v-if="isAdmin" icon="pi pi-trash" class="p-button-rounded p-button-danger" @click="$emit('delete', result)" />
        </div>
      </div>
      <div v-if="results.length === 0" class="no-results">
        No results found.
      </div>
    </div>
  </template>
  
  <script setup>
  defineProps({
    results: Array,
    getHouseNameForParticipant: Function,
    getCategoryNameForEvent: Function,
  });

  const isAdmin = computed(() => store.getters['auth/hasRole']('Admin'));
  </script>
  
  <style scoped>
  .results-mobile-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .result-card {
    background: #e0ebec;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    padding: 1rem;
    display: flex;
    flex-direction: column; 
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .result-main {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .result-actions {
    margin-top: 0.7rem;
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }
  .no-results {
    text-align: center;
    color: #888;
    margin-top: 2rem;
  }
  </style>