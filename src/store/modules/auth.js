import apiClient, { login as loginApi } from '@/service/api.service';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';


// Helper function to extract user ID from token - moved outside the actions object
function getUserIdFromToken(token) {
  try {
    const decoded = jwtDecode(token);
    // Extract the user ID from the nameidentifier claim
    return decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || '';
  } catch (error) {
    console.error('Error decoding token:', error);
    return '';
  }
}

const state = {
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  roles: JSON.parse(localStorage.getItem('roles')) || [],
  permissions: JSON.parse(localStorage.getItem('permissions')) || [],
  isRefreshing: false,
  refreshSubscribers: [],
  requestInterceptor: null, 
  responseInterceptor: null  
};

const getters = {
  isAuthenticated: state => !!state.token,
  currentUser: state => state.user,
  userName: state => state.user?.userName || '',
  userEmail: state => state.user?.email || '',
  userRoles: state => state.roles,
  userPermissions: state => state.permissions,
  hasRole: state => role => state.roles.includes(role),
  hasPermission: state => permission => state.permissions.includes(permission),
  hasAnyRole: state => roles => roles.some(role => state.roles.includes(role)),
  hasAllRoles: state => roles => roles.every(role => state.roles.includes(role)),
  hasAnyPermission: state => permissions => permissions.some(perm => state.permissions.includes(perm)),
  tokenExpiration: state => {
    if (!state.token) return null;
    const decoded = jwtDecode(state.token);
    return decoded.exp ? new Date(decoded.exp * 1000) : null;
  },
  isTokenExpired: (state, getters) => {
    const expiration = getters.tokenExpiration;
    if (!expiration) return true;
    // Consider token expired 1 minute before actual expiration to avoid edge cases
    return expiration <= new Date(Date.now() + 60 * 1000);
  }
};

const actions = {
  // Login action
  async login({ commit, dispatch }, credentials) {
    try {
      const response = await loginApi(credentials);
      
      // Patch: Accept backend response shape { token, role, username }
      const {
        token,
        refreshToken = '',
        userName = response.data.username,
        email = '',
        roles = response.data.role ? [response.data.role] : []
      } = response.data;
      
      // Validate we received required auth data
      if (!token) {
        throw new Error('Invalid authentication response');
      }
      
      // Create user object
      const user = {
        id: getUserIdFromToken(token),
        userName,
        email
      };
      
      // Save auth data with the correct format
      commit('SET_AUTH_DATA', { 
        token, 
        refreshToken, 
        user, 
        roles,
        permissions: [] 
      });
      
      // Setup interceptors only after successful login
      dispatch('setupInterceptors');

      console.log('Login successful');
      
      // Navigation happens in the component, not here
      // Let the component handle redirect
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      
      // Ensure auth data is cleared on failed login
      commit('CLEAR_AUTH_DATA');
      
      // Rethrow the error to be handled by the component
      throw error;
    }
  },

  
  
  // Register action
  async register({ commit }, userData) {
    try {
      const response = await apiClient.post('/auth/register', userData);
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  // Logout action
  async logout({ commit }) {
    try {
      // If your API requires a logout endpoint
      if (state.token) {
        await apiClient.post('/auth/logout', {
          refreshToken: state.refreshToken
        });
      }
      
      commit('CLEAR_AUTH_DATA');
      return true;
    } catch (error) {
      // Even if server logout fails, clear local auth data
      commit('CLEAR_AUTH_DATA');
      throw error;
    }
  },
  
  // Refresh token
  async refreshToken({ commit, state }) {
    // Prevent multiple refresh calls
    if (state.isRefreshing) {
      return new Promise((resolve, reject) => {
        state.refreshSubscribers.push({ resolve, reject });
      });
    }
    
    commit('SET_REFRESHING', true);
    
    try {
      const response = await axios.post('/api/refresh-token', {
        refreshToken: state.refreshToken
      });
      
      const { token, refreshToken } = response.data;
      
      commit('UPDATE_TOKENS', { token, refreshToken });
      commit('SET_REFRESHING', false);
      
      // Notify subscribers that token is refreshed
      state.refreshSubscribers.forEach(callback => callback.resolve(token));
      commit('CLEAR_SUBSCRIBERS');
      
      return token;
    } catch (error) {
      commit('SET_REFRESHING', false);
      
      // Notify subscribers about the error
      state.refreshSubscribers.forEach(callback => callback.reject(error));
      commit('CLEAR_SUBSCRIBERS');
      
      // Clear auth data on refresh failure
      commit('CLEAR_AUTH_DATA');
      throw error;
    }
  },
  
  // Check token and refresh if needed
  async checkTokenAndRefreshIfNeeded({ getters, dispatch }) {
    if (!getters.isAuthenticated) return null;
    
    if (getters.isTokenExpired) {
      try {
        return await dispatch('refreshToken');
      } catch (error) {
        return null;
      }
    }
    
    return state.token;
  },
  
  // Setup axios interceptors
  setupInterceptors({ commit, dispatch, state }) {
    // Remove existing interceptors
    axios.interceptors.request.eject(state.requestInterceptor);
    axios.interceptors.response.eject(state.responseInterceptor);
    
    // Add new request interceptor and store its reference
    state.requestInterceptor = axios.interceptors.request.use(
      async config => {
        // Skip auth header for auth endpoints
        if (config.url.includes('/auth/login') || 
            config.url.includes('/auth/register') || 
            config.url.includes('/auth/refresh-token')) {
          return config;
        }
        
        // Check and refresh token if needed
        const token = await dispatch('checkTokenAndRefreshIfNeeded');
        
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );
    
    // Add new response interceptor and store its reference
    state.responseInterceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        
        // Don't try to refresh for login/register requests
        if (originalRequest.url.includes('/auth/login') || 
            originalRequest.url.includes('/auth/register')) {
          return Promise.reject(error);
        }
        
        // If error is not 401 or request has already been retried, reject
        if (error.response?.status !== 401 || originalRequest._retry) {
          return Promise.reject(error);
        }
        
        originalRequest._retry = true;
        
        // Try to refresh the token
        try {
          const token = await dispatch('refreshToken');
          
          // Retry the original request with new token
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return axios(originalRequest);
        } catch (refreshError) {
          // If refresh fails, clear auth data and reject
          commit('CLEAR_AUTH_DATA');
          return Promise.reject(refreshError);
        }
      }
    );
  },
  
  // Fetch user profile (with fresh data from API)
  async fetchUserProfile({ commit, state }) {
    if (!state.token) throw new Error('Not authenticated');
    
    try {
      const response = await axios.get('/api/user/profile');
      const { user, roles, permissions } = response.data;
      
      commit('UPDATE_USER_DATA', { user, roles, permissions });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

const mutations = {
  SET_AUTH_DATA(state, { token, refreshToken, user, roles, permissions }) {
    state.token = token;
    state.refreshToken = refreshToken;
    state.user = user;
    state.roles = roles || [];
    state.permissions = permissions || [];
    
    // Store in localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('roles', JSON.stringify(roles || []));
    localStorage.setItem('permissions', JSON.stringify(permissions || []));
  },
  
  UPDATE_TOKENS(state, { token, refreshToken }) {
    state.token = token;
    state.refreshToken = refreshToken;
    
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
  },
  
  UPDATE_USER_DATA(state, { user, roles, permissions }) {
    state.user = user;
    state.roles = roles || state.roles;
    state.permissions = permissions || state.permissions;
    
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('roles', JSON.stringify(roles || state.roles));
    localStorage.setItem('permissions', JSON.stringify(permissions || state.permissions));
  },
  
  CLEAR_AUTH_DATA(state) {
    state.token = null;
    state.refreshToken = null;
    state.user = null;
    state.roles = [];
    state.permissions = [];
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    localStorage.removeItem('permissions');
  },
  
  SET_REFRESHING(state, isRefreshing) {
    state.isRefreshing = isRefreshing;
  },
  
  ADD_REFRESH_SUBSCRIBER(state, callback) {
    state.refreshSubscribers.push(callback);
  },
  
  CLEAR_SUBSCRIBERS(state) {
    state.refreshSubscribers = [];
  }
  ,

  // Add a separate function to set up the auth token
// setupAuthToken(token) {
//   if (token) {
//     apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
//   } else {
//     delete apiClient.defaults.headers.common['Authorization'];
//   }
// }
};




export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};