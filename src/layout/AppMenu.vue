<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import AppMenuItem from './AppMenuItem.vue';

// Get access to the store and router
const store = useStore();
const router = useRouter();

// Logout function
const logout = async () => {
  try {
    await store.dispatch('auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    router.push('/auth/login');
  }
};


// Define all menu items with their role requirements
const allMenuItems = [
  // This array is now just a placeholder; real menu is built in model below
];

// Check if user is authenticated
const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']);

// Create a computed property that filters menu items based on user's roles and permissions
const model = computed(() => {
  const roles = store.getters['auth/userRoles'] || [];
  let menuItems = [];
  if (roles.includes('Admin')) {
    menuItems = [
      { label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/app/' },
      { label: 'Admin Dashboard', icon: 'pi pi-fw pi-cog', to: '/app/admin-dashboard' }
    ];
  } else if (roles.includes('Judge') || roles.includes('Official')) {
    menuItems = [
      { label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/app/' },
      { label: 'Judge Dashboard', icon: 'pi pi-fw pi-star', to: '/app/judge-dashboard' }
    ];
  } else {
    menuItems = [
      { label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/app/' }
    ];
  }
  return [
    {
      label: 'Menu',
      items: menuItems
    },
    {
      items: [{
        label: 'Logout',
        icon: 'pi pi-fw pi-sign-out',
        command: logout
      }]
    }
  ];
});

// Get current user roles for display (optional)
const userRoles = computed(() => store.getters['auth/userRoles']);
</script>

<template>
  <div>
    <!-- Optional: Role info display for debugging -->
    <div v-if="isAuthenticated" class="user-role-info" style="margin-bottom: 10px; font-size: 0.8rem; color: #6c757d;">
      <span>Roles: {{ userRoles.join(', ') }}</span>
    </div>
    
    <ul class="layout-menu">
      <template v-for="(item, i) in model" :key="i">
        <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
        <li v-if="item.separator" class="menu-separator"></li>
      </template>
    </ul>
  </div>
</template>

<style lang="scss" scoped>
.user-role-info {
  padding: 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin-top: 5px;
}
</style>