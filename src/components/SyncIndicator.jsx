import { View, Text, TouchableOpacity } from "react-native";
import { useNetwork } from "../contexts/NetworkContext.js";
import { useTheme } from "../contexts/ThemeContext.js";

export function SyncIndicator() {
  const { queueSize, failedCount, sync, retryFailed, isOnline } = useNetwork();
  const { colors: C } = useTheme();

  if (queueSize === 0) return null;

  // Some ops permanently failed — show a distinct red indicator with retry action
  if (failedCount > 0 && failedCount === queueSize) {
    return (
      <TouchableOpacity
        onPress={retryFailed}
        activeOpacity={0.6}
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#E53935" }} />
        <Text style={{ fontSize: 11, color: "#E53935", fontWeight: "500" }}>
          {failedCount} failed · retry
        </Text>
      </TouchableOpacity>
    );
  }

  // Mix of pending + failed, or only pending
  return (
    <TouchableOpacity
      onPress={isOnline ? sync : undefined}
      activeOpacity={isOnline ? 0.6 : 1}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF9F27" }} />
      <Text style={{ fontSize: 11, color: "#EF9F27", fontWeight: "500" }}>
        {queueSize} pending{failedCount > 0 ? ` (${failedCount} failed)` : ""}
      </Text>
    </TouchableOpacity>
  );
}
