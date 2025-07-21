<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';

const store = useStore();
const router = useRouter();
const toast = useToast();

const userName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const role = 'Official'; // Hard-coded role as 'Official'
const loading = ref(false);

const register = async () => {
  // Validate form
  if (!userName.value || !email.value || !password.value) {
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: 'Please fill all required fields', 
      closable: true, 
      sticky: true 
    });
    return;
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value)) {
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: 'Please enter a valid email address', 
      closable: true, 
      sticky: true 
    });
    return;
  }
  
  // Validate password confirmation
  if (password.value !== confirmPassword.value) {
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: 'Passwords do not match', 
      closable: true, 
      sticky: true 
    });
    return;
  }
  
  // Set loading state
  loading.value = true;
  
  try {
    // Prepare registration data according to the required JSON structure
    const registrationData = {
      userName: userName.value,
      email: email.value,
      password: password.value,
      role: role // Use the hard-coded role value
    };
    
    // Call the register action in the auth store
    await store.dispatch('auth/register', registrationData);
    
    // Show success message
    toast.add({ 
      severity: 'success', 
      summary: 'Success', 
      detail: 'Registration successful! You can now log in.', 
      life: 3000 
    });
    
    // Redirect to login page
    router.push('/auth/login');
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle different error cases
    let errorMessage = 'Registration failed';
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    toast.add({
      severity: 'error',
      summary: 'Registration Failed',
      detail: errorMessage,
      life: 5000,
      closable: true,
      sticky: true,
      id: new Date().getTime().toString()
    });
  } finally {
    // Reset loading state with a small delay to avoid UI flicker
    setTimeout(() => {
      loading.value = false;
    }, 300);
  }
};

const loginNavigation = () => {
  router.push('/auth/login');
};
</script>

<template>
  <Toast position="top-center" />
  <FloatingConfigurator />
  <div class="bg-surface-200 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
    <div class="flex flex-col items-center justify-center">
      <div class="w-full py-20 px-8 sm:px-20" style="border-radius: 53px">
        <div class="text-center mb-8">
          <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Join C.H.S Scorer</div>
          <span class="text-muted-color font-medium">Create an account to get started</span>
        </div>
        <form @submit.prevent="register">
          <div>
            <!-- Username field -->
            <label for="username" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Username</label>
            <InputText id="username" type="text" placeholder="Enter username" class="w-full md:w-[30rem] mb-6" v-model="userName" />
            
            <!-- Email field -->
            <label for="email" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
            <InputText id="email" type="text" placeholder="Enter email address" class="w-full md:w-[30rem] mb-6" v-model="email" />
            
            <!-- Password field -->
            <label for="password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
            <Password id="password" v-model="password" placeholder="Enter password" :toggleMask="true" class="mb-6" fluid :feedback="true"></Password>
            
            <!-- Confirm Password field -->
            <label for="confirmPassword" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Confirm Password</label>
            <Password id="confirmPassword" v-model="confirmPassword" placeholder="Confirm password" :toggleMask="true" class="mb-6" fluid :feedback="false"></Password>
            
            <!-- Role information (display only) -->
            <div class="text-surface-700 dark:text-surface-300 mb-8">
              <small>You will be registered as an <strong>Official</strong></small>
            </div>
            
            <div class="flex items-center justify-end mt-2 mb-6">
              <span @click="loginNavigation" class="font-medium no-underline ml-2 text-right cursor-pointer text-primary">Already have an account? Log in</span>
            </div>
            
            <Button type="submit" label="Register" class="w-full" :loading="loading"></Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>