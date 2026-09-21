import { View, Text, TouchableOpacity } from "react-native";
import { useNetwork } from "../contexts/NetworkContext.js";
import { useTheme } from "../contexts/ThemeContext.js";

export function SyncIndicator() {
  const { queueSize, sync, isOnline } = useNetwork();
  const { colors: C } = useTheme();

  if (queueSize === 0) return null;

  return (
    <TouchableOpacity
      onPress={isOnline ? sync : undefined}
      activeOpacity={isOnline ? 0.6 : 1}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF9F27" }} />
      <Text style={{ fontSize: 11, color: "#EF9F27", fontWeight: "500" }}>
        {queueSize} pending
      </Text>
    </TouchableOpacity>
  );
}
