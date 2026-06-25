import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";

export interface BillingRow {
  childName: string;
  parentName: string;
  invoiceCount: number;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  overdueCents: number;
}

interface Props {
  schoolName: string;
  month: string;
  rows: BillingRow[];
  generatedAt: string;
}

function fmt(cents: number) {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

export function BillingReport({ schoolName, month, rows, generatedAt }: Props) {
  const totalRevenue = rows.reduce((s, r) => s + r.totalCents, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidCents, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstandingCents, 0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdueCents, 0);
  const collectionRate = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0;

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
            <Text style={styles.reportTitle}>Billing Report</Text>
            <Text style={styles.reportMeta}>{month}</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL BILLED</Text>
            <Text style={[styles.statValue, { fontSize: 13 }]}>{fmt(totalRevenue)}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: "#16a34a" }]}>
            <Text style={styles.statLabel}>COLLECTED</Text>
            <Text style={[styles.statValue, { fontSize: 13, color: "#16a34a" }]}>{fmt(totalPaid)}</Text>
            <Text style={styles.statSub}>Rate: {collectionRate}%</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: "#d97706" }]}>
            <Text style={styles.statLabel}>OUTSTANDING</Text>
            <Text style={[styles.statValue, { fontSize: 13, color: "#d97706" }]}>{fmt(totalOutstanding)}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: "#dc2626" }]}>
            <Text style={styles.statLabel}>OVERDUE</Text>
            <Text style={[styles.statValue, { fontSize: 13, color: "#dc2626" }]}>{fmt(totalOverdue)}</Text>
          </View>
        </View>

        {/* Table */}
        <Text style={styles.sectionTitle}>Per-Learner Breakdown</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Child</Text>
            <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Parent</Text>
            <Text style={styles.tableHeaderCell}>Billed</Text>
            <Text style={styles.tableHeaderCell}>Paid</Text>
            <Text style={styles.tableHeaderCell}>Outstanding</Text>
            <Text style={styles.tableHeaderCell}>Overdue</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={{ ...styles.tableCellBold, flex: 2 }}>{row.childName}</Text>
              <Text style={{ ...styles.tableCell, flex: 2 }}>{row.parentName}</Text>
              <Text style={styles.tableCell}>{fmt(row.totalCents)}</Text>
              <Text style={{ ...styles.tableCell, color: "#16a34a" }}>{fmt(row.paidCents)}</Text>
              <Text style={{ ...styles.tableCell, color: row.outstandingCents > 0 ? "#d97706" : "#374151" }}>{fmt(row.outstandingCents)}</Text>
              <Text style={{ ...styles.tableCell, color: row.overdueCents > 0 ? "#dc2626" : "#374151" }}>{fmt(row.overdueCents)}</Text>
            </View>
          ))}
          {/* Totals row */}
          <View style={[styles.tableRow, { backgroundColor: "#ede9fe", borderBottomWidth: 0 }]}>
            <Text style={{ ...styles.tableCellBold, flex: 2 }}>TOTAL</Text>
            <Text style={{ ...styles.tableCell, flex: 2 }} />
            <Text style={styles.tableCellBold}>{fmt(totalRevenue)}</Text>
            <Text style={[styles.tableCellBold, { color: "#16a34a" }]}>{fmt(totalPaid)}</Text>
            <Text style={[styles.tableCellBold, { color: "#d97706" }]}>{fmt(totalOutstanding)}</Text>
            <Text style={[styles.tableCellBold, { color: "#dc2626" }]}>{fmt(totalOverdue)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>LittleLoop — Confidential</Text>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
