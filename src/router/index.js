import AppLayout from '@/layout/AppLayout.vue';
import JudgeDashboard from '@/views/pages/JudgeDashboard.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { authGuard } from './guard/auth.guard';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'landing',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/register',
            name: 'register',
            component: () => import('@/views/pages/auth/Register.vue')
        },
        
        {
            path: '/app',
            component: AppLayout,
            children: [
                {
                    path: '',
                    name: 'dashboard',
                    meta:{
                        requiresAuth: true,
                    },
                    component: () => import('@/views/pages/Empty.vue')
                },
               
                 {
                     path: 'judge-dashboard',
                     name: 'JudgeDashboard',
                     component: JudgeDashboard,
                     meta: { requiresAuth: true, roles: ['Judge'] }
                 },
                //  {
                //      path: 'score/:houseId/:categoryId',
                //      name: 'Scoring',
                //      component: () => import('@/views/pages/Empty.vue'), // Placeholder, replace with real scoring view
                //      meta: { requiresAuth: true, roles: ['Judge'] }
                //  },
                 {
                     path: 'admin-dashboard',
                     name: 'AdminDashboard',
                     component: () => import('@/views/pages/AdminDashboard.vue'),
                     meta: { requiresAuth: true, roles: ['Admin'] }
                 }
        ]
        },
    
    ]
});


router.beforeEach(authGuard);
export default router;
