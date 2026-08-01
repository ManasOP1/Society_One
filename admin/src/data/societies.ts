export type PaymentStatus = "Paid" | "Pending" | "Failed" | "Partial";
export type BhkType = "ONE_BHK" | "TWO_BHK" | "THREE_BHK";
export type ComplaintStatus = "Open" | "In Progress" | "Resolved" | "Rejected";
export type Priority = "Low" | "Medium" | "High" | "Critical";

export interface Society {
  id: string;
  name: string;
  address: string;
  wings: string[];
  totalFlats: number;
  occupiedFlats: number;
  totalMembers: number;
  societyFund: number;
  pendingMaintenance: number;
  collectedThisMonth: number;
  collectionTarget: number;
  lateFeeTotal: number;
  adminName: string;
  adminEmail: string;
  password: string;
  status?: "active" | "inactive";
  createdAt?: string;
  createdBy?: string;
}

export interface Member {
  id: string;
  societyId: string;
  photo: string;
  flat: string;
  wing: string;
  owner: string;
  phone: string;
  email: string;
  /** Set by society admin — resident uses this to log into the mobile app. */
  password?: string;
  parking: string;
  /** Flat type — 1 / 2 / 3 BHK */
  bhkType?: BhkType;
  /** Monthly maintenance amount collected from this member */
  maintenanceAmount?: number;
  maintenance: PaymentStatus;
  hasAppLogin?: boolean;
}

export interface PaymentRecord {
  id: string;
  societyId: string;
  receiptNo: string;
  invoiceNo: string;
  month: string; // e.g. "2026-07"
  year: number;
  flatNo: string;
  wing: string;
  ownerName: string;
  mobile: string;
  maintenanceAmount: number;
  dueDate: string;
  paidAmount: number;
  paymentDate: string | null;
  paymentMode: string;
  utr: string;
  bank: string;
  lateFee: number;
  totalPaid: number;
  outstanding: number;
  status: PaymentStatus;
  collectedBy: string;
}

/** Legacy static seeds removed — live admin loads societies/members/payments from the API. */
export const societies: Society[] = [];
export const members: Member[] = [];
export const paymentRecords: PaymentRecord[] = [];
export const financialBySociety: Record<
  string,
  { month: string; collection: number; expense: number }[]
> = {};

export const REPORT_COLUMNS = [
  "Receipt No",
  "Invoice No",
  "Month",
  "Flat No",
  "Wing",
  "Owner Name",
  "Mobile",
  "Maintenance Amount",
  "Due Date",
  "Paid Amount",
  "Payment Date",
  "Payment Mode",
  "UTR / Transaction ID",
  "Bank",
  "Late Fee",
  "Total Paid",
  "Outstanding",
  "Status",
  "Collected By",
] as const;

export function paymentToReportRow(p: PaymentRecord) {
  return {
    "Receipt No": p.receiptNo,
    "Invoice No": p.invoiceNo,
    Month: p.month,
    "Flat No": p.flatNo,
    Wing: p.wing,
    "Owner Name": p.ownerName,
    Mobile: p.mobile,
    "Maintenance Amount": p.maintenanceAmount,
    "Due Date": p.dueDate,
    "Paid Amount": p.paidAmount,
    "Payment Date": p.paymentDate ?? "—",
    "Payment Mode": p.paymentMode,
    "UTR / Transaction ID": p.utr,
    Bank: p.bank,
    "Late Fee": p.lateFee,
    "Total Paid": p.totalPaid,
    Outstanding: p.outstanding,
    Status: p.status,
    "Collected By": p.collectedBy,
  };
}
