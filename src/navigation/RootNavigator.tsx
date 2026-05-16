import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import AuthNavigator from './AuthNavigator';
import AppStack from './AppStack';
import LoadingView from '@/components/LoadingView';

export default function RootNavigator() {
  const { authState } = useAuth();

  if (authState.status === 'loading') {
    return <LoadingView message="Starting up…" />;
  }

  return (
    <NavigationContainer>
      {authState.status === 'authenticated' ? <AppStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
