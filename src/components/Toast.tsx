import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

type ToastContextValue = {
  show: (message: string, opts?: { duration?: number; type?: ToastType }) => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>('success');
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(
      () => setMessage(null)
    );
  }, [opacity]);

  const show = useCallback(
    (msg: string, opts?: { duration?: number; type?: ToastType }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setType(opts?.type ?? 'success');
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
      const dur = Math.max(1000, opts?.duration ?? 2000);
      timeoutRef.current = setTimeout(hide, dur);
    },
    [hide, opacity]
  );

  return (
    <ToastCtx.Provider value={{ show }}>
      <View style={{ flex: 1 }}>{children}</View>
      {message ? (
        <Animated.View pointerEvents="none" style={[styles.container, { opacity }] }>
          <View style={[styles.toast, type === 'error' ? styles.error : type === 'info' ? styles.info : styles.success]}>
            <Text style={styles.text}>{message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.select({ ios: 48, android: 48, default: 24 }),
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    maxWidth: '90%',
  },
  success: { backgroundColor: '#16a34a' },
  error: { backgroundColor: '#dc2626' },
  info: { backgroundColor: '#2563eb' },
  text: { color: 'white', fontWeight: '700' },
});

