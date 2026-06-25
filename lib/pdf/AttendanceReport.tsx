import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { styles, BRAND } from "./styles";

export interface AttendanceRow {
  childName: string;
  className: string;
  daysPresent: number;
  daysAbsent: number;
  totalDays: number;
  rate: number; // 0–100
}

interface Props {
  schoolName: string;
  month: string; // e.g. "June 2026"
  rows: AttendanceRow[];
  generatedAt: string;
}

export function AttendanceReport({ schoolName, month, rows, generatedAt }: Props) {
  const totalPresent = rows.reduce((s, r) => s + r.daysPresent, 0);
  const totalDays = rows.reduce((s, r) => s + r.totalDays, 0);
  const avgRate = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;

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
            <Text style={styles.reportTitle}>Attendance Report</Text>
            <Text style={styles.reportMeta}>{month}</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL CHILDREN</Text>
            <Text style={styles.statValue}>{rows.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AVG ATTENDANCE RATE</Text>
            <Text style={styles.statValue}>{avgRate}%</Text>
            <Text style={styles.statSub}>across all learners</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>DAYS PRESENT</Text>
            <Text style={styles.statValue}>{totalPresent}</Text>
            <Text style={styles.statSub}>of {totalDays} possible</Text>
          </View>
        </View>

        {/* Table */}
        <Text style={styles.sectionTitle}>Learner Attendance</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Name</Text>
            <Text style={styles.tableHeaderCell}>Class</Text>
            <Text style={styles.tableHeaderCell}>Present</Text>
            <Text style={styles.tableHeaderCell}>Absent</Text>
            <Text style={styles.tableHeaderCell}>Rate</Text>
          </View>
          {rows.map((row, i) => {
            const rateColor = row.rate >= 80 ? "#16a34a" : row.rate >= 60 ? "#d97706" : "#dc2626";
            return (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={{ ...styles.tableCellBold, flex: 2 }}>{row.childName}</Text>
                <Text style={styles.tableCell}>{row.className}</Text>
                <Text style={styles.tableCell}>{row.daysPresent}</Text>
                <Text style={styles.tableCell}>{row.daysAbsent}</Text>
                <Text style={{ ...styles.tableCell, color: rateColor, fontFamily: "Helvetica-Bold" }}>{row.rate}%</Text>
              </View>
            );
          })}
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
