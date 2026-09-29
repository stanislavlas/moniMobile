import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal,
} from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { useKeyboardPadding } from "../../src/hooks/useKeyboardPadding.js";
import { useFeedback } from "../../src/hooks/useFeedback.js";
import { FeedbackBanner } from "../../src/components/FeedbackBanner.jsx";

const EMOJI_LIST = [
  "🛍️","🎮","🐾","🌿","🏖️","🎵","🍷","📚","🧘","🚴","🏥","🎁",
  "🧹","🔧","🌍","🍔","☕","🎓","💊","🏋️","🎨","✈️","🧴","🧃",
  "🥗","🍰","🚌","🎯","💡","🪴","🎪","🧩","🛒","🏠","💼","📱",
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🦁","🐮","🐸","🐙",
  "🌸","🌺","🌻","🍎","🍊","🍋","🍇","🍓","🥑","🌮","🍕","🍣",
  "⚽","🏀","🎾","🏊","🚵","🎻","🎹","🎲","🧸","💎","🔑","🎀",
  "💰","💳","🏦","📈","🏡","🚗","🚂","⛵","🎡","🎢","🏕️","🗺️",
];

export function CategoriesScreen({ incomeCategories, expenseCategories, investmentCategories = [], customCats, onCreateCategory, onDeleteCategory }) {
  const { colors: C, styles: S } = useTheme();
  const keyboardPadding = useKeyboardPadding();
  const { feedback, flash } = useFeedback();
  const [tab, setTab]               = useState("expense");
  const [showForm, setShowForm]     = useState(false);
  const [label, setLabel]           = useState("");
  const [emoji, setEmoji]           = useState("");
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [saving, setSaving]         = useState(false);

  const styles = {
    tabBar:        { flexDirection: "row", backgroundColor: C.bgSecondary, borderRadius: 10, padding: 4, marginBottom: 20 },
    tab:           { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 8 },
    tabActive:     { backgroundColor: C.bg, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    tabText:       { fontSize: 13, color: C.textTertiary },
    tabTextActive: { fontWeight: "600", color: C.text },
    addBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bgSecondary },
    emojiBtn:      { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "transparent", justifyContent: "center", alignItems: "center" },
    preview:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bgSecondary },
    deleteBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 0.5, borderColor: C.redBorder },
    builtInBadge:  { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: C.bgTertiary },
  };

  async function handleCreate() {
    if (!label.trim()) return flash(false, "Enter a category name.");
    setSaving(true);
    try {
      await onCreateCategory({ label: label.trim(), emoji: emoji.trim() || "🙂", type: tab });
      setLabel(""); setEmoji(""); setShowForm(false);
      flash(true, `"${label.trim()}" added.`);
    } catch (e) { flash(false, e.message); }
    finally { setSaving(false); }
  }

  function confirmDelete(cat) {
    if (cat.categoryId.startsWith("temp-")) {
      Alert.alert("Not synced yet", "This category is still being saved. Please wait a moment and try again.");
      return;
    }
    Alert.alert(
      "Delete category",
      `Delete "${cat.label}"? Existing entries using it won't be affected.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDeleteCategory(cat.categoryId) },
      ]
    );
  }

  const allCatsForTab = tab === "income" ? incomeCategories : tab === "investment" ? investmentCategories : expenseCategories;
  const customForTab = customCats.filter(c => c.type === tab);
  const customIds = new Set(customCats.map(c => c.categoryId));
  const builtInCats = allCatsForTab.filter(c => !customIds.has(c.id || c.categoryId));

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ paddingBottom: 40 + keyboardPadding }} keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
      {/* Title */}
      <Text style={[S.h2, { marginBottom: 14 }]}>Categories</Text>

      <FeedbackBanner feedback={feedback} />

      {/* Tab toggle */}
      <View style={styles.tabBar}>
        {[
          { id: "expense",    label: "💸 Expenses" },
          { id: "income",     label: "💰 Income"   },
          { id: "investment", label: "📈 Invest"   },
        ].map(t => (
          <TouchableOpacity
            key={t.id} onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add new category */}
      <View style={[S.rowBetween, { marginBottom: 12 }]}>
        <Text style={S.sectionTitle}>Custom categories</Text>
        <TouchableOpacity
          onPress={() => { setShowForm(v => !v); setLabel(""); setEmoji(""); }}
          style={styles.addBtn}
        >
          <Text style={{ fontSize: 12, fontWeight: "500", color: C.text }}>
            {showForm ? "Cancel" : "+ Add"}
          </Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={[S.card, { marginBottom: 16 }]}>
          {/* Emoji + Name in one row */}
          <Text style={[S.label, { marginBottom: 8 }]}>Name</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setShowEmojiModal(true)}
              style={{
                width: 50, height: 50, borderRadius: 10,
                backgroundColor: C.bgSecondary, borderWidth: 0.5, borderColor: C.borderMed,
                justifyContent: "center", alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 26 }}>{emoji || "🙂"}</Text>
            </TouchableOpacity>
            <TextInput
              style={[S.input, { flex: 1, marginBottom: 0 }]}
              placeholder={tab === "expense" ? "e.g. Pet care, Parking…" : "e.g. Bonus, Side job…"}
              placeholderTextColor={C.textTertiary}
              value={label} onChangeText={setLabel}
            />
          </View>

          <TouchableOpacity
            style={[S.btnPrimary, { backgroundColor: tab === "income" ? C.green : tab === "investment" ? C.blue : C.red }]}
            onPress={handleCreate} disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={S.btnPrimaryText}>Save category</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Custom categories list */}
      {customForTab.length > 0 ? (
        <View style={{ borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: "hidden", marginBottom: 24 }}>
          {customForTab.map((cat, i) => (
            <View key={cat.categoryId}>
              {i > 0 && <View style={S.divider} />}
              <View style={[S.rowBetween, { padding: 14 }]}>
                <View style={S.row}>
                  <Text style={{ fontSize: 22, marginRight: 12 }}>{cat.emoji}</Text>
                  <View>
                    <Text style={S.body}>{cat.label}</Text>
                    <Text style={[S.small, { fontSize: 11 }]}>Custom · {tab}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => confirmDelete(cat)} style={styles.deleteBtn}>
                  <Text style={{ fontSize: 12, color: C.red }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[S.small, { textAlign: "center", paddingVertical: 16, marginBottom: 16 }]}>
          No custom {tab} categories yet.
        </Text>
      )}

      {/* Built-in categories (read-only reference) */}
      <Text style={[S.sectionTitle, { marginTop: 8 }]}>Built-in categories</Text>
      <View style={{ borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: "hidden" }}>
        {builtInCats.map((cat, i) => (
          <View key={cat.id}>
            {i > 0 && <View style={S.divider} />}
            <View style={[S.row, { padding: 12, paddingHorizontal: 14 }]}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{cat.emoji}</Text>
              <Text style={[S.body, { flex: 1 }]}>{cat.label}</Text>
              <View style={styles.builtInBadge}>
                <Text style={{ fontSize: 10, color: C.textTertiary }}>built-in</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
      </View>

      {/* Emoji picker modal */}
      <Modal visible={showEmojiModal} transparent animationType="slide" onRequestClose={() => setShowEmojiModal(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setShowEmojiModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 }}>
              {/* Handle */}
              <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderMed }} />
              </View>

              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 }}>
                <Text style={[S.h3]}>Choose emoji</Text>
                <TouchableOpacity onPress={() => setShowEmojiModal(false)}>
                  <Text style={{ fontSize: 14, color: C.textSecondary }}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Custom input */}
              <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <TextInput
                  style={[S.input, { marginBottom: 0 }]}
                  placeholder="Or type / paste any emoji"
                  placeholderTextColor={C.textTertiary}
                  value={emoji}
                  onChangeText={t => {
                    const chars = [...t];
                    if (chars.length > 0) setEmoji(chars[chars.length - 1]);
                    else setEmoji("");
                  }}
                />
              </View>

              {/* Grid */}
              <ScrollView
                contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 4 }}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 320 }}
              >
                {EMOJI_LIST.map(e => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => { setEmoji(e); setShowEmojiModal(false); }}
                    style={[styles.emojiBtn, emoji === e && { backgroundColor: C.bgTertiary, borderColor: C.borderMed }]}
                  >
                    <Text style={{ fontSize: 26 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}


