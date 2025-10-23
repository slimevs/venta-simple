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
import { Ionicons } from '@expo/vector-icons';
import { ToastProvider } from './src/components/Toast';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <ToastProvider>
      <ProductsProvider>
        <SalesProvider>
          <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarActiveTintColor: '#1d4ed8',
              tabBarInactiveTintColor: '#6b7280',
              tabBarLabelStyle: { fontSize: 12, marginBottom: 2 },
              tabBarIcon: ({ focused, color }) => {
                const size = focused ? 30 : 26;
                let name: React.ComponentProps<typeof Ionicons>['name'];
                switch (route.name) {
                  case 'Ventas':
                    name = focused ? 'cart' : 'cart-outline';
                    break;
                  case 'Productos':
                    name = focused ? 'cube' : 'cube-outline';
                    break;
                  case 'Reportes':
                    name = focused ? 'stats-chart' : 'stats-chart-outline';
                    break;
                  default:
                    name = 'ellipse-outline';
                }
                return <Ionicons name={name} size={size} color={color} />;
              },
            })}
          >
            <Tab.Screen name="Ventas" component={SalesScreen} options={{ title: 'Ventas' }} />
            <Tab.Screen name="Productos" component={ProductsScreen} options={{ title: 'Productos' }} />
            <Tab.Screen name="Reportes" component={ReportsScreen} options={{ title: 'Reportes' }} />
          </Tab.Navigator>
          <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
          </NavigationContainer>
        </SalesProvider>
      </ProductsProvider>
    </ToastProvider>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f7f7f7',
  },
};
