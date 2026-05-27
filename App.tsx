import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CompanyProvider } from './src/context/CompanyContext';
import { OverdueProvider } from './src/context/OverdueContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initDateFormat } from './src/utils/settings';

export default function App() {
  useEffect(() => {
    initDateFormat();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CompanyProvider>
          <OverdueProvider>
            <RootNavigator />
          </OverdueProvider>
        </CompanyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
