import React from 'react';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { Colors, Typography } from '@/theme';

type Props = {
  message?: string;
};

export default function LoadingView({ message }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  message: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
