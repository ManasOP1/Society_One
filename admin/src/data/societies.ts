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
  password: string; // demo only — replace with auth service later
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

export const societies: Society[] = [
  {
    id: "green-valley",
    name: "Green Valley Residency",
    address: "Baner Road, Pune 411045",
    wings: ["A", "B", "C", "D"],
    totalFlats: 150,
    occupiedFlats: 128,
    totalMembers: 153,
    societyFund: 1845000,
    pendingMaintenance: 215000,
    collectedThisMonth: 1720000,
    collectionTarget: 2000000,
    lateFeeTotal: 12500,
    adminName: "Jonathan Smith",
    adminEmail: "admin@greenvalley.in",
    password: "admin123",
  },
  {
    id: "sunrise-heights",
    name: "Sunrise Heights",
    address: "Hinjewadi Phase 1, Pune 411057",
    wings: ["A", "B", "C"],
    totalFlats: 90,
    occupiedFlats: 82,
    totalMembers: 96,
    societyFund: 980000,
    pendingMaintenance: 145000,
    collectedThisMonth: 820000,
    collectionTarget: 950000,
    lateFeeTotal: 8000,
    adminName: "Priya Deshmukh",
    adminEmail: "admin@sunriseheights.in",
    password: "admin123",
  },
  {
    id: "lakeview-apartments",
    name: "Lakeview Apartments",
    address: "Kharadi, Pune 411014",
    wings: ["East", "West"],
    totalFlats: 60,
    occupiedFlats: 54,
    totalMembers: 68,
    societyFund: 620000,
    pendingMaintenance: 78000,
    collectedThisMonth: 540000,
    collectionTarget: 600000,
    lateFeeTotal: 4500,
    adminName: "Rahul Mehta",
    adminEmail: "admin@lakeview.in",
    password: "admin123",
  },
];

export const members: Member[] = [
  // Green Valley (legacy static seed — live admin loads from API)
  { id: "1", societyId: "green-valley", photo: "RP", flat: "203", wing: "A", owner: "Rahul Patil", phone: "9876543210", email: "rahul.patil@email.com", parking: "P-12", maintenance: "Paid", hasAppLogin: true },
  { id: "2", societyId: "green-valley", photo: "PS", flat: "105", wing: "B", owner: "Suresh Sharma", phone: "9876543211", email: "priya.sharma@email.com", parking: "P-24", maintenance: "Pending" },
  { id: "3", societyId: "green-valley", photo: "AD", flat: "412", wing: "C", owner: "Amit Desai", phone: "9876543212", email: "amit.desai@email.com", parking: "P-08", maintenance: "Paid" },
  { id: "4", societyId: "green-valley", photo: "SJ", flat: "118", wing: "A", owner: "Sneha Joshi", phone: "9876543213", email: "sneha.joshi@email.com", parking: "P-31", maintenance: "Failed" },
  { id: "5", societyId: "green-valley", photo: "VM", flat: "301", wing: "D", owner: "Vikram Mehta", phone: "9876543214", email: "vikram.mehta@email.com", parking: "P-45", maintenance: "Paid" },
  { id: "6", societyId: "green-valley", photo: "AR", flat: "205", wing: "C", owner: "Anita Rao", phone: "9876543215", email: "anita.rao@email.com", parking: "P-19", maintenance: "Pending" },
  // Sunrise
  { id: "7", societyId: "sunrise-heights", photo: "NK", flat: "101", wing: "A", owner: "Neha Kulkarni", phone: "9876500001", email: "neha.k@email.com", parking: "P-01", maintenance: "Paid" },
  { id: "8", societyId: "sunrise-heights", photo: "SK", flat: "204", wing: "B", owner: "Sanjay Kale", phone: "9876500002", email: "sanjay.k@email.com", parking: "P-14", maintenance: "Pending" },
  { id: "9", societyId: "sunrise-heights", photo: "RJ", flat: "310", wing: "C", owner: "Ramesh Jadhav", phone: "9876500003", email: "ramesh.j@email.com", parking: "P-22", maintenance: "Paid" },
  // Lakeview
  { id: "10", societyId: "lakeview-apartments", photo: "PG", flat: "12", wing: "East", owner: "Pooja Gupta", phone: "9876511001", email: "pooja.g@email.com", parking: "E-01", maintenance: "Paid" },
  { id: "11", societyId: "lakeview-apartments", photo: "AS", flat: "28", wing: "West", owner: "Arjun Singh", phone: "9876511002", email: "arjun.s@email.com", parking: "W-05", maintenance: "Pending" },
];

function makePayment(
  partial: Omit<PaymentRecord, "totalPaid" | "outstanding"> & {
    totalPaid?: number;
    outstanding?: number;
  }
): PaymentRecord {
  const totalPaid = partial.totalPaid ?? partial.paidAmount + partial.lateFee;
  const outstanding =
    partial.outstanding ??
    Math.max(0, partial.maintenanceAmount + partial.lateFee - totalPaid);
  return { ...partial, totalPaid, outstanding };
}

export const paymentRecords: PaymentRecord[] = [
  makePayment({
    id: "p1", societyId: "green-valley", receiptNo: "RCP-2026-001", invoiceNo: "INV-2026-07-A203",
    month: "2026-07", year: 2026, flatNo: "203", wing: "A", ownerName: "Rahul Patil", mobile: "9876543210",
    maintenanceAmount: 2500, dueDate: "2026-07-10", paidAmount: 2500, paymentDate: "2026-07-08",
    paymentMode: "UPI", utr: "UPI1234567890", bank: "HDFC", lateFee: 0, status: "Paid", collectedBy: "System",
  }),
  makePayment({
    id: "p2", societyId: "green-valley", receiptNo: "RCP-2026-002", invoiceNo: "INV-2026-07-B105",
    month: "2026-07", year: 2026, flatNo: "105", wing: "B", ownerName: "Suresh Sharma", mobile: "9876543211",
    maintenanceAmount: 2500, dueDate: "2026-07-10", paidAmount: 0, paymentDate: null,
    paymentMode: "—", utr: "—", bank: "—", lateFee: 100, status: "Pending", collectedBy: "—",
  }),
  makePayment({
    id: "p3", societyId: "green-valley", receiptNo: "RCP-2026-003", invoiceNo: "INV-2026-07-C412",
    month: "2026-07", year: 2026, flatNo: "412", wing: "C", ownerName: "Amit Desai", mobile: "9876543212",
    maintenanceAmount: 3200, dueDate: "2026-07-10", paidAmount: 3200, paymentDate: "2026-07-09",
    paymentMode: "Net Banking", utr: "NB9988776655", bank: "ICICI", lateFee: 0, status: "Paid", collectedBy: "System",
  }),
  makePayment({
    id: "p4", societyId: "green-valley", receiptNo: "RCP-2026-004", invoiceNo: "INV-2026-06-A118",
    month: "2026-06", year: 2026, flatNo: "118", wing: "A", ownerName: "Sneha Joshi", mobile: "9876543213",
    maintenanceAmount: 2500, dueDate: "2026-06-10", paidAmount: 0, paymentDate: null,
    paymentMode: "—", utr: "—", bank: "—", lateFee: 200, status: "Pending", collectedBy: "—",
  }),
  makePayment({
    id: "p5", societyId: "green-valley", receiptNo: "RCP-2026-005", invoiceNo: "INV-2026-07-D301",
    month: "2026-07", year: 2026, flatNo: "301", wing: "D", ownerName: "Vikram Mehta", mobile: "9876543214",
    maintenanceAmount: 2800, dueDate: "2026-07-10", paidAmount: 2900, paymentDate: "2026-07-15",
    paymentMode: "Credit Card", utr: "CC5566778899", bank: "SBI", lateFee: 100, status: "Paid", collectedBy: "Guard Desk",
  }),
  makePayment({
    id: "p6", societyId: "green-valley", receiptNo: "RCP-2025-088", invoiceNo: "INV-2025-12-C205",
    month: "2025-12", year: 2025, flatNo: "205", wing: "C", ownerName: "Anita Rao", mobile: "9876543215",
    maintenanceAmount: 2500, dueDate: "2025-12-10", paidAmount: 2500, paymentDate: "2025-12-05",
    paymentMode: "UPI", utr: "UPI1122334455", bank: "Axis", lateFee: 0, status: "Paid", collectedBy: "System",
  }),
  makePayment({
    id: "p7", societyId: "sunrise-heights", receiptNo: "SH-RCP-001", invoiceNo: "SH-INV-2026-07-A101",
    month: "2026-07", year: 2026, flatNo: "101", wing: "A", ownerName: "Neha Kulkarni", mobile: "9876500001",
    maintenanceAmount: 2200, dueDate: "2026-07-10", paidAmount: 2200, paymentDate: "2026-07-07",
    paymentMode: "UPI", utr: "UPI7788990011", bank: "HDFC", lateFee: 0, status: "Paid", collectedBy: "System",
  }),
  makePayment({
    id: "p8", societyId: "sunrise-heights", receiptNo: "SH-RCP-002", invoiceNo: "SH-INV-2026-07-B204",
    month: "2026-07", year: 2026, flatNo: "204", wing: "B", ownerName: "Sanjay Kale", mobile: "9876500002",
    maintenanceAmount: 2200, dueDate: "2026-07-10", paidAmount: 0, paymentDate: null,
    paymentMode: "—", utr: "—", bank: "—", lateFee: 150, status: "Pending", collectedBy: "—",
  }),
  makePayment({
    id: "p9", societyId: "lakeview-apartments", receiptNo: "LV-RCP-001", invoiceNo: "LV-INV-2026-07-E12",
    month: "2026-07", year: 2026, flatNo: "12", wing: "East", ownerName: "Pooja Gupta", mobile: "9876511001",
    maintenanceAmount: 3000, dueDate: "2026-07-10", paidAmount: 3000, paymentDate: "2026-07-06",
    paymentMode: "Wallet", utr: "WL3344556677", bank: "Paytm", lateFee: 0, status: "Paid", collectedBy: "System",
  }),
  makePayment({
    id: "p10", societyId: "lakeview-apartments", receiptNo: "LV-RCP-002", invoiceNo: "LV-INV-2026-07-W28",
    month: "2026-07", year: 2026, flatNo: "28", wing: "West", ownerName: "Arjun Singh", mobile: "9876511002",
    maintenanceAmount: 3000, dueDate: "2026-07-10", paidAmount: 0, paymentDate: null,
    paymentMode: "—", utr: "—", bank: "—", lateFee: 100, status: "Pending", collectedBy: "—",
  }),
];

export const financialBySociety: Record<
  string,
  { month: string; collection: number; expense: number }[]
> = {
  "green-valley": [
    { month: "Jan", collection: 145000, expense: 98000 },
    { month: "Feb", collection: 152000, expense: 110000 },
    { month: "Mar", collection: 148000, expense: 105000 },
    { month: "Apr", collection: 160000, expense: 125000 },
    { month: "May", collection: 155000, expense: 118000 },
    { month: "Jun", collection: 170000, expense: 132000 },
    { month: "Jul", collection: 165000, expense: 128000 },
    { month: "Aug", collection: 175000, expense: 140000 },
    { month: "Sep", collection: 168000, expense: 135000 },
    { month: "Oct", collection: 180000, expense: 145000 },
    { month: "Nov", collection: 172000, expense: 138000 },
    { month: "Dec", collection: 190000, expense: 150000 },
  ],
  "sunrise-heights": [
    { month: "Jan", collection: 72000, expense: 48000 },
    { month: "Feb", collection: 75000, expense: 52000 },
    { month: "Mar", collection: 70000, expense: 50000 },
    { month: "Apr", collection: 78000, expense: 55000 },
    { month: "May", collection: 80000, expense: 58000 },
    { month: "Jun", collection: 82000, expense: 60000 },
    { month: "Jul", collection: 82000, expense: 61000 },
    { month: "Aug", collection: 85000, expense: 62000 },
    { month: "Sep", collection: 83000, expense: 60000 },
    { month: "Oct", collection: 88000, expense: 65000 },
    { month: "Nov", collection: 86000, expense: 64000 },
    { month: "Dec", collection: 90000, expense: 68000 },
  ],
  "lakeview-apartments": [
    { month: "Jan", collection: 48000, expense: 32000 },
    { month: "Feb", collection: 50000, expense: 34000 },
    { month: "Mar", collection: 49000, expense: 33000 },
    { month: "Apr", collection: 52000, expense: 36000 },
    { month: "May", collection: 51000, expense: 35000 },
    { month: "Jun", collection: 54000, expense: 38000 },
    { month: "Jul", collection: 54000, expense: 37000 },
    { month: "Aug", collection: 55000, expense: 39000 },
    { month: "Sep", collection: 53000, expense: 37000 },
    { month: "Oct", collection: 56000, expense: 40000 },
    { month: "Nov", collection: 55000, expense: 39000 },
    { month: "Dec", collection: 58000, expense: 41000 },
  ],
};

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
