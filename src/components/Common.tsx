import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  error?: string | null;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.label, error ? { color: '#b91c1c' } : null]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        style={[styles.input, error ? { borderColor: '#ef4444' } : null]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled = false }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const bg = variant === 'primary' ? '#1d4ed8' : variant === 'danger' ? '#dc2626' : '#6b7280';
  const finalBg = disabled ? '#9ca3af' : bg;
  return (
    <Pressable disabled={disabled} onPress={() => !disabled && onPress()} style={[styles.btn, { backgroundColor: finalBg, opacity: disabled ? 0.7 : 1 }]}>
      <Text style={styles.btnText}>{title}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  card: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, color: '#374151', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'white' },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  small: { fontSize: 12, color: '#6b7280' },
  errorText: { fontSize: 12, color: '#b91c1c', marginTop: 4 },
});
