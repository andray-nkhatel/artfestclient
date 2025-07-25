import AppLayout from '@/layout/AppLayout.vue';
import JudgeDashboard from '@/views/pages/JudgeDashboard.vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { authGuard } from './guard/auth.guard';

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            redirect: '/auth/login'
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
                // {
                //     path: '',
                //     name: 'dashboard',
                //     meta:{
                //         requiresAuth: true,
                //     },
                //     component: () => import('@/views/pages/Empty.vue')
                // },
               
                 {
                     path: 'judge-dashboard',
                     name: 'JudgeDashboard',
                     component: JudgeDashboard,
                     meta: { requiresAuth: true, roles: ['Judge'] }
                 },
              
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
