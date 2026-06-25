import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { Child, MedicalRecord } from "@/lib/types";

interface Props {
  schoolName: string;
  child: Child;
  medical: MedicalRecord | null;
  parentNames: string[];
  generatedAt: string;
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function ChildProfileReport({ schoolName, child, medical, parentNames, generatedAt }: Props) {
  const dob = child.dateOfBirth ? new Date(child.dateOfBirth).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const enrolled = child.enrolledAt ? new Date(child.enrolledAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>LittleLoop</Text>
            <Text style={styles.logoSub}>{schoolName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.reportTitle}>Child Profile</Text>
            <Text style={styles.reportMeta}>Confidential</Text>
          </View>
        </View>

        {/* Child identity */}
        <View style={{ backgroundColor: "#f5f3ff", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#4F46E5", marginBottom: 4 }}>
            {child.firstName} {child.lastName}
          </Text>
          <View style={{ flexDirection: "row", gap: 20 }}>
            <Text style={styles.infoValue}>DOB: {dob}</Text>
            <Text style={styles.infoValue}>Enrolled: {enrolled}</Text>
            {child.allergies && child.allergies.length > 0 && (
              <Text style={{ ...styles.infoValue, color: "#dc2626", fontFamily: "Helvetica-Bold" }}>⚠ Has Allergies</Text>
            )}
          </View>
          {parentNames.length > 0 && (
            <Text style={{ ...styles.infoValue, marginTop: 4, color: "#6b7280" }}>
              Guardian{parentNames.length > 1 ? "s" : ""}: {parentNames.join(", ")}
            </Text>
          )}
        </View>

        {/* Medical info */}
        {medical && (
          <>
            <Text style={styles.sectionTitle}>Medical Information</Text>

            {medical.allergies && medical.allergies.length > 0 && (
              <>
                <Text style={{ ...styles.infoLabel, marginBottom: 4 }}>ALLERGIES</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Allergen</Text>
                    <Text style={styles.tableHeaderCell}>Severity</Text>
                    <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Reaction</Text>
                  </View>
                  {medical.allergies.map((a, i) => (
                    <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                      <Text style={{ ...styles.tableCellBold, flex: 2 }}>{a.name}</Text>
                      <Text style={{ ...styles.tableCell, color: a.severity === "severe" ? "#dc2626" : a.severity === "moderate" ? "#d97706" : "#16a34a", fontFamily: "Helvetica-Bold" }}>
                        {a.severity}
                      </Text>
                      <Text style={{ ...styles.tableCell, flex: 2 }}>{a.reaction ?? "—"}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {medical.medications && medical.medications.length > 0 && (
              <>
                <Text style={{ ...styles.infoLabel, marginTop: 8, marginBottom: 4 }}>MEDICATIONS</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Name</Text>
                    <Text style={styles.tableHeaderCell}>Dose</Text>
                    <Text style={styles.tableHeaderCell}>Frequency</Text>
                    <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Instructions</Text>
                  </View>
                  {medical.medications.map((m, i) => (
                    <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                      <Text style={{ ...styles.tableCellBold, flex: 2 }}>{m.name}</Text>
                      <Text style={styles.tableCell}>{m.dose ?? "—"}</Text>
                      <Text style={styles.tableCell}>{m.frequency ?? "—"}</Text>
                      <Text style={{ ...styles.tableCell, flex: 2 }}>{m.instructions ?? "—"}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {medical.conditions && medical.conditions.length > 0 && (
              <>
                <Text style={{ ...styles.infoLabel, marginTop: 8, marginBottom: 4 }}>CONDITIONS</Text>
                {medical.conditions.map((c, i) => (
                  <Text key={i} style={{ ...styles.infoValue, marginBottom: 3 }}>• {c.name}{c.notes ? `: ${c.notes}` : ""}</Text>
                ))}
              </>
            )}

            <View style={[styles.infoGrid, { marginTop: 10 }]}>
              <InfoItem label="Blood Type" value={medical.bloodType} />
              <InfoItem label="Dietary Requirements" value={medical.dietary ? Object.entries(medical.dietary).filter(([k,v]) => v === true).map(([k]) => k.replace(/([A-Z])/g," $1").trim()).join(", ") || undefined : undefined} />
              <InfoItem label="GP / Doctor" value={medical.doctorName} />
              <InfoItem label="Doctor Phone" value={medical.doctorPhone} />
            </View>
          </>
        )}

        {/* Emergency contacts */}
        {medical?.emergencyContacts && medical.emergencyContacts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Name</Text>
                <Text style={styles.tableHeaderCell}>Relationship</Text>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Phone</Text>
                <Text style={styles.tableHeaderCell}>Authorised Pickup</Text>
              </View>
              {medical.emergencyContacts.map((ec, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={{ ...styles.tableCellBold, flex: 2 }}>{ec.name}</Text>
                  <Text style={styles.tableCell}>{ec.relationship}</Text>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{ec.phone}</Text>
                  <Text style={{ ...styles.tableCell, color: ec.canPickup ? "#16a34a" : "#dc2626", fontFamily: "Helvetica-Bold" }}>
                    {ec.canPickup ? "Yes" : "No"}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>LittleLoop — Confidential. Authorised staff only.</Text>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
