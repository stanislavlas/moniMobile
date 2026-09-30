import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform
} from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { useFeedback } from "../../src/hooks/useFeedback.js";
import { FeedbackBanner } from "../../src/components/FeedbackBanner.jsx";

export function HouseholdScreen({
  household,
  user,
  onCreate,
  onInvite,
  onCancelInvitation,
  onRemoveMember,
  onLeave,
  onDelete,
  onRename,
  autoOpenInvite,
}) {
  const { colors: C, styles: S } = useTheme();
  const [view, setView]        = useState("main"); // main | invite | rename
  const [nameInput, setName]   = useState("");
  const [emailInput, setEmail] = useState("");
  const [busy, setBusy]        = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const { feedback, flash }    = useFeedback();
  const [sentPending, setSentPending] = useState([]);

  useEffect(() => {
    if (autoOpenInvite && household) setView("invite");
  }, [autoOpenInvite, household]);

  // Fetch pending sent invitations whenever the owner has a household
  useEffect(() => {
    if (!household || !user || user.householdRole !== "OWNER") return;
    let cancelled = false;
    import("../../src/services/household.js")
      .then(({ getSentInvitations }) => getSentInvitations())
      .then(data => { if (!cancelled) setSentPending((data ?? []).filter(i => i.status === "PENDING")); })
      .catch(e => { if (!cancelled) flash(false, e.message ?? "Failed to load sent invitations"); });
    return () => { cancelled = true; };
  }, [household?.householdId, flash]);

  const localStyles = {
    avatar:    { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    smallBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bgSecondary },
    dangerRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    dangerText:{ fontSize: 14, fontWeight: "500", color: C.red },
  };

  const isOwner = user?.householdRole === "OWNER";

  async function handleCreate() {
    if (!nameInput.trim()) return flash(false, "Enter a household name.");
    setBusy(true);
    try { await onCreate(nameInput.trim()); setName(""); setView("main"); }
    catch (e) { flash(false, e.message); }
    finally { setBusy(false); }
  }

  async function handleInvite() {
    if (!emailInput.includes("@")) return flash(false, "Enter a valid email address.");
    Keyboard.dismiss(); setBusy(true);
    try {
      const result = await onInvite(emailInput.trim().toLowerCase());
      setEmail(""); setView("main"); flash(true, "Invitation sent.");
      if (result && result.invitationId) {
        setSentPending(prev => [result, ...prev]);
      }
    }
    catch (e) { flash(false, e.message); }
    finally { setBusy(false); }
  }

  async function handleCancelInvitation(invitationId) {
    setBusy(true);
    try {
      await onCancelInvitation(invitationId);
      if (mountedRef.current) setSentPending(prev => prev.filter(i => i.invitationId !== invitationId));
      // Refresh from server to get authoritative state
      import("../../src/services/household.js")
        .then(({ getSentInvitations }) => getSentInvitations())
        .then(data => { if (mountedRef.current) setSentPending((data ?? []).filter(i => i.status === "PENDING")); })
        .catch(() => {});
      if (mountedRef.current) flash(true, "Invitation cancelled.");
    } catch (e) {
      if (mountedRef.current) flash(false, e.message ?? "Failed to cancel invitation.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  function confirmRemove(memberId, memberName) {
    Alert.alert("Remove member", `Remove ${memberName} from the household?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await onRemoveMember(memberId); } catch (e) { flash(false, e.message); }
      }},
    ]);
  }

  function confirmLeave() {
    if (isOwner) {
      Alert.alert("Cannot Leave", "As the owner, you cannot leave. Delete the household or transfer ownership first.", [{ text: "OK" }]);
      return;
    }
    Alert.alert("Leave household", "You will lose access to all shared entries.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: async () => {
        try { await onLeave(); } catch (e) { flash(false, e.message); }
      }},
    ]);
  }

  function confirmDelete() {
    Alert.alert("Delete household", "All members will be unlinked. Transaction data is kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await onDelete(); } catch (e) { flash(false, e.message); }
      }},
    ]);
  }

  async function handleRename() {
    if (!nameInput.trim()) return flash(false, "Enter a name.");
    setBusy(true);
    try { await onRename(nameInput.trim()); setName(""); setView("main"); }
    catch (e) { flash(false, e.message); }
    finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView style={S.screen} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <Text style={[S.h2, { marginBottom: 14 }]}>Household</Text>
        <FeedbackBanner feedback={feedback} />

        {/* No household — create form */}
        {!household ? (
          <>
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🏠</Text>
              <Text style={[S.h2, { marginBottom: 8 }]}>No household yet</Text>
              <Text style={[S.small, { textAlign: "center", maxWidth: 280 }]}>
                Create a household to share your budget.
              </Text>
            </View>
            <Text style={[S.label, { marginBottom: 6 }]}>Household name</Text>
            <TextInput style={S.input} placeholder="e.g. Our Home, Family Budget…"
              placeholderTextColor={C.textTertiary} value={nameInput} onChangeText={setName} />
            <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green }]} onPress={handleCreate} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Create household</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Household card */}
            <View style={[S.card, { backgroundColor: C.greenLight, borderColor: C.greenBorder, marginBottom: 20 }]}>
              {view === "rename" ? (
                <>
                  <Text style={[S.label, { marginBottom: 6 }]}>New name</Text>
                  <TextInput style={[S.input, { backgroundColor: "#fff" }]} value={nameInput} onChangeText={setName} autoFocus />
                  <View style={[S.row, { gap: 8 }]}>
                    <TouchableOpacity style={[S.btnPrimary, { flex: 1, backgroundColor: C.green, marginTop: 0 }]} onPress={handleRename} disabled={busy}>
                      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={S.btnPrimaryText}>Save</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[S.btnPrimary, { flex: 1, backgroundColor: "transparent", borderWidth: 0.5, borderColor: C.greenBorder, marginTop: 0 }]}
                      onPress={() => { setView("main"); setName(""); }}>
                      <Text style={{ fontSize: 15, color: C.greenDark }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={S.rowBetween}>
                  <View>
                    <Text style={[S.label, { color: C.greenDark, marginBottom: 4 }]}>Household</Text>
                    <Text style={[S.h2, { color: "#085041" }]}>{household.name}</Text>
                    <Text style={{ fontSize: 12, color: C.greenDark, marginTop: 3 }}>
                      {(household.members || []).length} member{(household.members || []).length !== 1 ? "s" : ""} · {isOwner ? "Owner" : "Member"}
                    </Text>
                  </View>
                  {isOwner && (
                    <TouchableOpacity onPress={() => { setView("rename"); setName(household.name); }}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: C.greenBorder }}>
                      <Text style={{ fontSize: 12, color: C.greenDark }}>Rename</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Invite button (owner only) */}
            {isOwner && view !== "invite" && view !== "rename" && (
              <TouchableOpacity
                style={[S.card, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16, backgroundColor: C.greenLight, borderColor: C.greenBorder }]}
                onPress={() => setView("invite")}>
                <Text style={{ fontSize: 18 }}>✉️</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: C.greenDark }}>Invite Member</Text>
              </TouchableOpacity>
            )}

            {/* Invite form */}
            {view === "invite" && isOwner && (
              <View style={[S.card, { marginBottom: 12 }]}>
                <Text style={[S.label, { marginBottom: 6 }]}>Invite by email</Text>
                <TextInput style={S.input} placeholder="their@email.com"
                  placeholderTextColor={C.textTertiary} value={emailInput} onChangeText={setEmail}
                  keyboardType="email-address" autoCapitalize="none" autoFocus />
                <Text style={[S.small, { marginBottom: 10 }]}>They will receive an invitation to accept or reject in the app.</Text>
                <View style={[S.row, { gap: 8 }]}>
                  <TouchableOpacity style={[S.btnPrimary, { flex: 1, backgroundColor: C.green }]} onPress={handleInvite} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Send invitation</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.btnPrimary, { flex: 1, backgroundColor: "transparent", borderWidth: 0.5, borderColor: C.border }]}
                    onPress={() => { Keyboard.dismiss(); setView("main"); setEmail(""); }}>
                    <Text style={{ fontSize: 15, color: C.text }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Sent invitations — pending only, always visible for owner */}
            {isOwner && sentPending.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[S.label, { marginBottom: 8 }]}>Sent invitations (Pending)</Text>
                {sentPending.map((inv) => (
                  <View key={inv.invitationId}
                    style={{ borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: "hidden", marginBottom: 6 }}>
                    <View style={[S.row, { padding: 12, justifyContent: "space-between" }]}>
                      <View>
                        <Text style={[S.body, { fontWeight: "500" }]}>{inv.invitedEmail}</Text>
                        <Text style={S.small}>Waiting for response</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleCancelInvitation(inv.invitationId)}
                        disabled={busy}
                        style={{ paddingHorizontal: 10, paddingVertical: 4 }}
                      >
                        <Text style={{ fontSize: 13, color: C.red, opacity: busy ? 0.4 : 1 }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Member list */}
            <View style={{ borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: "hidden", marginBottom: 24 }}>
              {(household.members || []).map((m, i) => {
                const isMe   = m.userId === user?.userId;
                const mOwner = m.userId === household.ownerId;
                const displayName = m.name;
                return (
                  <View key={m.userId}>
                    {i > 0 && <View style={S.divider} />}
                    <View style={[S.row, { padding: 14 }]}>
                      <View style={[localStyles.avatar, { backgroundColor: mOwner ? C.greenLight : C.bgTertiary }]}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: mOwner ? C.greenDark : C.textSecondary }}>
                          {displayName?.charAt(0)?.toUpperCase() || "?"}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[S.body, { fontWeight: "500" }]}>{displayName}{isMe ? " (you)" : ""}</Text>
                        <Text style={S.small}>{m.email}</Text>
                      </View>
                      <View style={[S.row, { gap: 8 }]}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 0.5,
                          borderColor: mOwner ? C.greenBorder : C.border,
                          backgroundColor: mOwner ? C.greenLight : C.bgSecondary }}>
                          <Text style={{ fontSize: 11, color: mOwner ? C.greenDark : C.textTertiary }}>
                            {mOwner ? "Owner" : "Member"}
                          </Text>
                        </View>
                        {isOwner && !mOwner && (
                           <TouchableOpacity onPress={() => confirmRemove(m.userId, m.name)}>
                            <Text style={{ fontSize: 16, color: C.red }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Danger zone */}
            <View style={{ borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: "hidden" }}>
              {!isOwner && (
                <TouchableOpacity style={localStyles.dangerRow} onPress={confirmLeave}>
                  <Text style={{ fontSize: 17 }}>🚪</Text>
                  <Text style={localStyles.dangerText}>Leave household</Text>
                </TouchableOpacity>
              )}
              {isOwner && (
                <TouchableOpacity style={localStyles.dangerRow} onPress={confirmDelete}>
                  <Text style={{ fontSize: 17 }}>🗑️</Text>
                  <Text style={localStyles.dangerText}>Delete household</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
