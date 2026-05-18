import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface Props {
  color?: string;
  label?: string;
}

export default function BackButton({ color = '#fff', label }: Props) {
  const navigation = useNavigation();
  if (!navigation.canGoBack()) return null;

  return (
    <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={[styles.arrow, { color }]}>‹</Text>
      {label && <Text style={[styles.label, { color }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  arrow: { fontSize: 28, fontWeight: '300', lineHeight: 30 },
  label: { fontSize: 14, fontWeight: '500', marginLeft: 2 },
});
