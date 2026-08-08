import React from "react";
import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "../theme/colors";
import DashboardScreen from "../screens/DashboardScreen";
import CalendarScreen from "../screens/CalendarScreen";
import GalleryScreen from "../screens/GalleryScreen";
import MedicalScreen from "../screens/MedicalScreen";

export type RootTabParamList = {
  Home: undefined;
  Calendar: undefined;
  Gallery: undefined;
  Medical: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, string> = {
  Home: "🏠",
  Calendar: "🗓️",
  Gallery: "📸",
  Medical: "🩺"
};

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.inkSoft,
          tabBarStyle: { backgroundColor: colors.white },
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name as keyof RootTabParamList]}</Text>
        })}
      >
        <Tab.Screen name="Home" component={DashboardScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="Gallery" component={GalleryScreen} />
        <Tab.Screen name="Medical" component={MedicalScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
