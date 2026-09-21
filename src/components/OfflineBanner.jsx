/**
 * OfflineBanner Component
 * -----------------------
 * Persistent banner shown when the device is offline AND there are
 * pending operations queued. Dismissible but re-appears on new operations.
 *
 * Placement: below app header, above main content
 */

import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSync } from "../hooks/useSync.js";

export function OfflineBanner() {
  const { isOnline, queueSize } = useSync();
  const [dismissed, setDismissed] = useState(false);

  // Re-show banner if new operations are queued after dismissal
  useEffect(() => {
    if (queueSize > 0) {
      setDismissed(false);
    }
  }, [queueSize]);

  // Only show when offline with pending changes and not dismissed
  if (isOnline || queueSize === 0 || dismissed) {
    return null;
  }

  return (
    <View style={{
      backgroundColor: "#FFF3CD",
      borderBottomWidth: 0.5,
      borderBottomColor: "#FAC775",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 8,
    }}>
      <Text style={{ fontSize: 13, color: "#854F0B", flex: 1 }}>
        Offline — {queueSize} change{queueSize !== 1 ? "s" : ""} will sync when online
      </Text>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={{ fontSize: 16, color: "#854F0B", fontWeight: "600" }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}
