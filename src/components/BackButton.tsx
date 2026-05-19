import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/theme';

interface Props {
  color?: string;
  label?: string;
}

export default function BackButton({ color = Colors.text, label }: Props) {
  const navigation = useNavigation();
  if (!navigation.canGoBack()) return null;

  return (
    <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Feather name="chevron-left" size={22} color={color} />
      {label && <Text style={[styles.label, { color }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  label: { fontSize: 14, fontWeight: '500', marginLeft: 2 },
});
