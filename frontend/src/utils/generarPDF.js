/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 *
 * Genera un PDF con el reporte del portafolio:
 * - Resumen general
 * - Posiciones
 * - Transacciones recientes
 * - Métricas del Dashboard
 * - Resumen técnico
 */
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ACCENT = [59, 130, 246];
const GRAY = [156, 163, 175];
const DARK = [17, 24, 39];

export default async function generarPDFPortafolio({ portafolio, posiciones, transacciones }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 15;

  // ─── Header ───────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Lakshmi Q2', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte de Portafolio', 14, 18);
  doc.setTextColor(...GRAY);
  doc.text(new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 14, 24);
  doc.text(`Portafolio: ${portafolio.nombre}`, W - 14, 18, { align: 'right' });
  doc.text(`Moneda: ${portafolio.moneda || 'USD'}`, W - 14, 24, { align: 'right' });
  y = 36;

  // ─── Resumen ──────────────────────────────────────────────────
  const activas = (posiciones || []).filter(p => p.cantidad > 0 && p.precio_actual > 0);
  const valorTotal = activas.reduce((s, p) => s + (p.valor_mercado || p.precio_actual * p.cantidad), 0);
  const pnlTotal = activas.reduce((s, p) => s + (p.pnl_bruto || 0), 0);

  y = seccion(doc, 'Resumen General', y);
  const resumenData = [
    ['Valor Total', `$${valorTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
    ['Posiciones Activas', `${activas.length}`],
    ['P&L Bruto Total', `$${pnlTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
    ['Capital Inicial', `$${(portafolio.capital_inicial || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
  ];
  doc.autoTable({
    startY: y,
    body: resumenData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 30, 30] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ─── Posiciones ───────────────────────────────────────────────
  y = seccion(doc, 'Posiciones', y);
  if (activas.length > 0) {
    doc.autoTable({
      startY: y,
      head: [['Ticker', 'Cantidad', 'Precio Prom.', 'Precio Actual', 'Valor Mercado', 'P&L Bruto', 'P&L %']],
      body: activas.map(p => [
        p.ticker,
        fmt(p.cantidad, 0),
        `$${fmt(p.precio_promedio)}`,
        `$${fmt(p.precio_actual)}`,
        `$${fmt(p.valor_mercado || p.precio_actual * p.cantidad)}`,
        `$${fmt(p.pnl_bruto)}`,
        `${fmt(p.pnl_porcentual)}%`,
      ]),
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ─── Transacciones recientes ──────────────────────────────────
  const txList = transacciones?.items || transacciones?.transacciones || [];
  if (txList.length > 0) {
    y = checkPage(doc, y, 40);
    y = seccion(doc, 'Transacciones Recientes (últimas 20)', y);
    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Ticker', 'Tipo', 'Cantidad', 'Precio', 'Total']],
      body: txList.slice(0, 20).map(tx => [
        tx.fecha?.substring(0, 10) || '—',
        tx.ticker,
        tx.tipo,
        fmt(tx.cantidad, 0),
        `$${fmt(tx.precio_unitario)}`,
        `$${fmt((tx.cantidad || 0) * (tx.precio_unitario || 0))}`,
      ]),
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ─── Dashboard (métricas) ─────────────────────────────────────
  if (activas.length >= 2) {
    try {
      const res = await fetch(`/api/portafolios/${portafolio.id}/dashboard`);
      if (res.ok) {
        const dash = await res.json();
        y = checkPage(doc, y, 60);
        y = seccion(doc, 'Dashboard — Métricas de Riesgo', y);

        const m = dash.metricas;
        const metricasData = [
          ['Rendimiento Anual', `${m.rendimiento}%`],
          ['Riesgo (Volatilidad)', `${m.riesgo}%`],
          ['Sharpe Ratio', `${m.sharpe}`],
          ['Sortino Ratio', `${m.sortino}`],
          ['Beta vs SPY', `${m.beta}`],
          ['Max Drawdown', `${m.max_drawdown}%`],
          ['VaR 99% Diario', `$${m.var.diario_usd} (${m.var.diario}%)`],
          ['VaR 99% Anual', `$${m.var.anual_usd} (${m.var.anual}%)`],
        ];
        if (dash.twr) {
          metricasData.push(['TWR (Rend. Real)', `${dash.twr.twr_total}% (${dash.twr.dias} días)`]);
          metricasData.push(['TWR Anualizado', `${dash.twr.twr_anualizado}%`]);
        }
        doc.autoTable({
          startY: y,
          body: metricasData,
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 2 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 4;

        // Pesos actuales
        if (dash.pesos) {
          y = checkPage(doc, y, 30);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(60, 60, 60);
          doc.text('Pesos Actuales:', 14, y);
          y += 4;
          doc.autoTable({
            startY: y,
            head: [['Ticker', 'Peso (%)', 'Contrib. Riesgo (%)']],
            body: dash.tickers.map(t => [t, `${dash.pesos[t]}%`, `${dash.risk_contrib[t]}%`]),
            headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { left: 14, right: 14 },
          });
          y = doc.lastAutoTable.finalY + 4;
        }

        // Resumen técnico
        if (dash.resumen_tecnico?.length > 0) {
          y = checkPage(doc, y, 30);
          y = seccion(doc, 'Resumen Técnico por Activo', y);
          doc.autoTable({
            startY: y,
            head: [['Ticker', 'Precio', 'RSI', 'MACD Hist.', 'SMA 50', 'Tendencia', 'Señales']],
            body: dash.resumen_tecnico.map(t => [
              t.ticker,
              t.error ? '—' : `$${t.precio}`,
              t.rsi ?? '—',
              t.macd_histograma != null ? t.macd_histograma.toFixed(2) : '—',
              t.sma50 ?? '—',
              t.tendencia || '—',
              (t.señales || []).join(', ') || '—',
            ]),
            headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
            styles: { fontSize: 7, cellPadding: 2 },
            margin: { left: 14, right: 14 },
          });
          y = doc.lastAutoTable.finalY + 6;
        }
      }
    } catch (e) {
      // Dashboard fetch failed, skip
    }
  }

  // ─── Footer ───────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Lakshmi Q2 — Generado el ${new Date().toLocaleString('es-MX')}`, 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Página ${i} de ${pages}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  doc.save(`Portafolio_${portafolio.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Helpers ────────────────────────────────────────────────────
function seccion(doc, titulo, y) {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ACCENT);
  doc.text(titulo, 14, y);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5);
  return y + 6;
}

function checkPage(doc, y, needed) {
  if (y + needed > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage();
    return 15;
  }
  return y;
}

function fmt(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
