import { StyleSheet } from "@react-pdf/renderer";

export const BRAND = "#4F46E5"; // indigo

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: "36pt 40pt",
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  logoText: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BRAND },
  logoSub: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  reportTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#111827" },
  reportMeta: { fontSize: 8, color: "#6b7280", marginTop: 3 },
  // Section
  sectionTitle: {
    fontSize: 11, fontFamily: "Helvetica-Bold",
    color: BRAND, marginBottom: 8, marginTop: 16,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  // Table
  table: { width: "100%", marginBottom: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 8, fontFamily: "Helvetica-Bold",
    color: "#ffffff", flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  tableCell: { fontSize: 9, color: "#374151", flex: 1 },
  tableCellBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827", flex: 1 },
  // Summary cards
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, borderRadius: 6, padding: 10,
    backgroundColor: "#f5f3ff",
    borderLeftWidth: 3, borderLeftColor: BRAND,
  },
  statLabel: { fontSize: 8, color: "#6b7280", marginBottom: 3 },
  statValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BRAND },
  statSub: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  // Footer
  footer: {
    position: "absolute", bottom: 24, left: 40, right: 40,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 6,
  },
  footerText: { fontSize: 7, color: "#9ca3af" },
  // Badge
  badgeGreen: { backgroundColor: "#dcfce7", color: "#16a34a", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontFamily: "Helvetica-Bold" },
  badgeRed: { backgroundColor: "#fee2e2", color: "#dc2626", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontFamily: "Helvetica-Bold" },
  badgeAmber: { backgroundColor: "#fef3c7", color: "#d97706", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontFamily: "Helvetica-Bold" },
  // Info rows
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  infoItem: { width: "45%" },
  infoLabel: { fontSize: 7, color: "#6b7280", fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 2 },
  infoValue: { fontSize: 9, color: "#111827" },
});
