import 'react-native-gesture-handler';
import React from 'react';
import { ProductsScreen } from './src/screens/ProductsScreen';
import { SalesScreen } from './src/screens/SalesScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { ProductsProvider } from './src/state/ProductsContext';
import { SalesProvider } from './src/state/SalesContext';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <ProductsProvider>
      <SalesProvider>
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#1d4ed8',
              tabBarInactiveTintColor: '#6b7280',
            }}
          >
            <Tab.Screen name="Ventas" component={SalesScreen} />
            <Tab.Screen name="Productos" component={ProductsScreen} />
            <Tab.Screen name="Reportes" component={ReportsScreen} />
          </Tab.Navigator>
          <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
        </NavigationContainer>
      </SalesProvider>
    </ProductsProvider>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f7f7f7',
  },
};
