import * as XLSX from "xlsx";
import path from "path";

export interface ParsedColumn {
  name: string;
  detectedType: "number" | "date" | "category" | "percentage" | "text";
  isMetric: boolean;
  isDimension: boolean;
  sampleValues: string[];
}

export interface ParsedSheet {
  name: string;
  rows: Record<string, unknown>[];
  columns: ParsedColumn[];
}

export interface ExcelParseResult {
  sheets: ParsedSheet[];
  totalRows: number;
  detectedPeriod: string | null;
  detectedBrand: string | null;
  summary: string;
}

const BRAND_KEYWORDS = [
  "volkswagen", "vw", "chevrolet", "ford", "toyota", "honda", "renault",
  "fiat", "peugeot", "citroën", "citroen", "nissan", "hyundai", "kia",
  "jeep", "ram", "dodge", "bmw", "mercedes", "audi",
];

const MONTH_NAMES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function detectColumnType(values: unknown[]): "number" | "date" | "category" | "percentage" | "text" {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");

  if (nonNull.length === 0) return "text";

  const percentageCount = nonNull.filter(
    (v) => typeof v === "string" && v.trim().endsWith("%"),
  ).length;
  if (percentageCount > nonNull.length * 0.5) return "percentage";

  const numberCount = nonNull.filter((v) => typeof v === "number" || !isNaN(Number(v))).length;
  if (numberCount > nonNull.length * 0.7) return "number";

  const dateCount = nonNull.filter((v) => {
    if (v instanceof Date) return true;
    if (typeof v === "string") {
      const d = new Date(v);
      return !isNaN(d.getTime());
    }
    return false;
  }).length;
  if (dateCount > nonNull.length * 0.5) return "date";

  const uniqueValues = new Set(nonNull.map(String));
  if (uniqueValues.size <= Math.min(20, nonNull.length * 0.3)) return "category";

  return "text";
}

function isLikelyMetric(name: string, type: string): boolean {
  const metricKeywords = [
    "ventas", "venta", "monto", "importe", "total", "cantidad", "unidades",
    "precio", "costo", "margen", "utilidad", "ganancia", "ingreso", "revenue",
    "stock", "inventario", "horas", "productividad", "facturacion", "facturación",
    "patentamiento", "operaciones", "ticket", "promedio", "rentabilidad",
    "absorcion", "absorción", "share", "participacion", "participación",
  ];
  const lower = name.toLowerCase();
  return type === "number" && metricKeywords.some((k) => lower.includes(k));
}

function isLikelyDimension(name: string, type: string): boolean {
  const dimensionKeywords = [
    "marca", "modelo", "sucursal", "vendedor", "cliente", "categoria",
    "categoría", "tipo", "segmento", "region", "región", "zona", "canal",
    "estado", "status", "mes", "año", "anio", "periodo", "período", "brand",
  ];
  const lower = name.toLowerCase();
  return (type === "category" || type === "text") && dimensionKeywords.some((k) => lower.includes(k));
}

function detectPeriod(filename: string, rows: Record<string, unknown>[]): { month: number | null; year: number | null; label: string | null } {
  // Try from filename
  const yearMatch = filename.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  let month: number | null = null;
  const lowerFilename = filename.toLowerCase();
  for (const [name, num] of Object.entries(MONTH_NAMES)) {
    if (lowerFilename.includes(name)) {
      month = num;
      break;
    }
  }

  if (month && year) {
    const monthName = Object.entries(MONTH_NAMES).find(([, n]) => n === month)?.[0] ?? "";
    return { month, year, label: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}` };
  }

  return { month, year, label: year ? String(year) : null };
}

function detectBrand(filename: string, rows: Record<string, unknown>[]): string | null {
  const lower = filename.toLowerCase();
  for (const brand of BRAND_KEYWORDS) {
    if (lower.includes(brand)) {
      return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
  }

  // Check first few rows
  for (const row of rows.slice(0, 5)) {
    for (const val of Object.values(row)) {
      if (typeof val === "string") {
        const vLower = val.toLowerCase();
        for (const brand of BRAND_KEYWORDS) {
          if (vLower.includes(brand)) {
            return brand.charAt(0).toUpperCase() + brand.slice(1);
          }
        }
      }
    }
  }

  return null;
}

export function parseExcelFile(buffer: Buffer, filename: string): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const sheets: ParsedSheet[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: false,
    });

    if (rawRows.length === 0) continue;

    const columnNames = Object.keys(rawRows[0] ?? {});
    const columns: ParsedColumn[] = columnNames.map((name) => {
      const values = rawRows.map((r) => r[name]);
      const detectedType = detectColumnType(values);
      const sampleValues = values
        .filter((v) => v !== null && v !== undefined && v !== "")
        .slice(0, 5)
        .map(String);

      return {
        name,
        detectedType,
        isMetric: isLikelyMetric(name, detectedType),
        isDimension: isLikelyDimension(name, detectedType),
        sampleValues,
      };
    });

    sheets.push({ name: sheetName, rows: rawRows, columns });
    totalRows += rawRows.length;
  }

  const allRows = sheets[0]?.rows ?? [];
  const period = detectPeriod(filename, allRows);
  const brand = detectBrand(filename, allRows);

  const firstSheet = sheets[0];
  const metricCount = firstSheet?.columns.filter((c) => c.isMetric).length ?? 0;
  const dimensionCount = firstSheet?.columns.filter((c) => c.isDimension).length ?? 0;
  const columnCount = firstSheet?.columns.length ?? 0;

  const summary = [
    `Se detectaron ${columnCount} columnas`,
    `${metricCount} ${metricCount === 1 ? "métrica" : "métricas"}`,
    `${dimensionCount} ${dimensionCount === 1 ? "dimensión" : "dimensiones"}`,
    period.label ? `Período: ${period.label}` : null,
    brand ? `Marca: ${brand}` : null,
    sheets.length > 1 ? `${sheets.length} hojas` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sheets,
    totalRows,
    detectedPeriod: period.label,
    detectedBrand: brand,
    summary,
  };
}
