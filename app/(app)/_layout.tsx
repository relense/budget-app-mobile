import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-category" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit-category" options={{ presentation: 'modal' }} />
      <Stack.Screen name="add-transaction" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit-transaction" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
