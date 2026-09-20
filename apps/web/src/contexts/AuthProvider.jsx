import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from './auth-context.js';
import { changePassword, getCurrentUser, signIn, signOut } from '../services/auth.service.js';

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const userQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: signIn,
    onSuccess: (user) => queryClient.setQueryData(['auth', 'me'], user),
  });

  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSettled: () => queryClient.setQueryData(['auth', 'me'], null),
  });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: (user) => queryClient.setQueryData(['auth', 'me'], user),
  });

  const value = {
    user: userQuery.data || null,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    refresh: userQuery.refetch,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    changePassword: changePasswordMutation.mutateAsync,
    isChangingPassword: changePasswordMutation.isPending,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
