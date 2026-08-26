import {
  addDecimals,
  isNonNegativeDecimal,
  isPositiveDecimal,
  multiplyDecimals,
  parseDecimal,
  subtractDecimals,
  toCanonicalDecimal,
} from "@/modules/farm-core/domain/decimal";

/**
 * Domain rules and pure calculations for Sale & Cash Ledger.
 *
 * Rules:
 * - quantity is decimal(14,3), positive
 * - unit_price is decimal(14,2), non-negative
 * - gross_amount = round(quantity * unit_price, 2)
 * - deductions is decimal(14,2), non-negative, <= gross_amount
 * - net_amount = gross_amount - deductions
 * - sale is sole revenue source
 * - cash profit = SUM(active sales.net_amount) - SUM(active expenses.amount)
 */

export function calculateSaleGross(quantity: string, unitPrice: string): string {
  const q = parseDecimal(quantity, 3) ?? "0.000";
  const p = parseDecimal(unitPrice, 2) ?? "0.00";
  return multiplyDecimals(q, p, 2);
}

export function calculateSaleNet(grossAmount: string, deductions: string): string {
  const g = parseDecimal(grossAmount, 2) ?? "0.00";
  const d = parseDecimal(deductions, 2) ?? "0.00";
  return subtractDecimals(g, d, 2);
}

export type SaleCalculationResult = {
  grossAmount: string;
  netAmount: string;
  isValid: boolean;
  error?: string;
};

export function calculateSale(
  quantity: string,
  unitPrice: string,
  deductions = "0.00",
): SaleCalculationResult {
  const parsedQty = parseDecimal(quantity, 3);
  if (!parsedQty || !isPositiveDecimal(parsedQty)) {
    return {
      grossAmount: "0.00",
      netAmount: "0.00",
      isValid: false,
      error: "ปริมาณผลผลิตต้องมากกว่า 0",
    };
  }

  const parsedPrice = parseDecimal(unitPrice, 2);
  if (!parsedPrice || !isNonNegativeDecimal(parsedPrice)) {
    return {
      grossAmount: "0.00",
      netAmount: "0.00",
      isValid: false,
      error: "ราคาต่อหน่วยต้องไม่ติดลบ",
    };
  }

  const parsedDeductions = parseDecimal(deductions, 2) ?? "0.00";
  if (!isNonNegativeDecimal(parsedDeductions)) {
    return {
      grossAmount: "0.00",
      netAmount: "0.00",
      isValid: false,
      error: "ค่าหัก ณ ที่จ่ายต้องไม่ติดลบ",
    };
  }

  const gross = calculateSaleGross(parsedQty, parsedPrice);
  const net = calculateSaleNet(gross, parsedDeductions);

  if (!isNonNegativeDecimal(net)) {
    return {
      grossAmount: gross,
      netAmount: net,
      isValid: false,
      error: "ค่าหัก ณ ที่จ่ายต้องไม่เกินมูลค่ารวม",
    };
  }

  return {
    grossAmount: gross,
    netAmount: net,
    isValid: true,
  };
}

export function validateSaleCalculation(input: {
  quantity: string;
  unitPrice: string;
  grossAmount: string;
  deductions: string;
  netAmount: string;
}): boolean {
  const expectedGross = calculateSaleGross(input.quantity, input.unitPrice);
  if (toCanonicalDecimal(input.grossAmount, 2) !== expectedGross) {
    return false;
  }
  const expectedNet = calculateSaleNet(expectedGross, input.deductions);
  if (toCanonicalDecimal(input.netAmount, 2) !== expectedNet) {
    return false;
  }
  return true;
}

export type SaleRecordForSummary = {
  netAmount: string;
  isDeleted?: boolean;
};

export type ExpenseRecordForSummary = {
  amount: string;
  isDeleted?: boolean;
};

export type PeriodCashResult = {
  netIncome: string;
  expenseTotal: string;
  cashResult: string;
  activeSaleCount: number;
  activeExpenseCount: number;
};

export function calculatePeriodCashResult(
  sales: readonly SaleRecordForSummary[],
  expenses: readonly ExpenseRecordForSummary[],
): PeriodCashResult {
  const activeSales = sales.filter((s) => !s.isDeleted);
  const activeExpenses = expenses.filter((e) => !e.isDeleted);

  let netIncome = "0.00";
  for (const sale of activeSales) {
    netIncome = addDecimals(netIncome, sale.netAmount, 2);
  }

  let expenseTotal = "0.00";
  for (const expense of activeExpenses) {
    expenseTotal = addDecimals(expenseTotal, expense.amount, 2);
  }

  const cashResult = subtractDecimals(netIncome, expenseTotal, 2);

  return {
    netIncome,
    expenseTotal,
    cashResult,
    activeSaleCount: activeSales.length,
    activeExpenseCount: activeExpenses.length,
  };
}
