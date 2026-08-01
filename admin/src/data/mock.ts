/** Legacy dashboard demo data — emptied so unused widgets never show invented rows. */
export type PaymentStatus = "Paid" | "Pending" | "Failed";
export type ComplaintStatus = "Open" | "In Progress" | "Resolved" | "Rejected";
export type Priority = "Low" | "Medium" | "High" | "Critical";

export const societyInfo = {
  name: "",
  adminName: "",
  adminRole: "Admin",
  totalMembers: 0,
  occupiedFlats: 0,
  totalFlats: 0,
  societyFund: 0,
  activeEvents: 0,
  pendingMaintenance: 0,
  collectionTarget: 0,
  collected: 0,
};

export const financialData: { month: string; collection: number; expense: number }[] = [];
export const membersByAge: { name: string; value: number; color: string }[] = [];
export const ownersVsTenants: { name: string; value: number; color: string }[] = [];
export const upcomingEvents: { id: number; title: string; date: string; color: string }[] = [];
export const calendarEvents: {
  date: number;
  type: "event" | "maintenance";
  label: string;
}[] = [];
export const recentPayments: {
  id: number;
  flat: string;
  name: string;
  amount: number;
  status: PaymentStatus;
  avatar: string;
}[] = [];
export const latestComplaints: {
  id: number;
  resident: string;
  flat: string;
  issue: string;
  priority: Priority;
  status: ComplaintStatus;
}[] = [];
export const activities: {
  id: number;
  title: string;
  description: string;
  time: string;
  type: "payment" | "visitor" | "complaint" | "notice" | "event";
}[] = [];
export const notices: {
  id: number;
  title: string;
  date: string;
  excerpt: string;
}[] = [];
export const members: {
  id: number;
  photo: string;
  flat: string;
  owner: string;
  tenant: string;
  phone: string;
  email: string;
  parking: string;
  maintenance: PaymentStatus;
}[] = [];
export const financeSummary: {
  label: string;
  amount: number;
  type: "income" | "expense";
}[] = [];
export const events: {
  id: number;
  title: string;
  date: string;
  endDate: string;
  location: string;
  budget: number;
  rsvp: number;
  status: string;
}[] = [];
export const visitors: {
  id: number;
  name: string;
  flat: string;
  vehicle: string;
  expectedTime: string;
  status: string;
  purpose: string;
}[] = [];

export const navItems = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/finance", label: "Finance", icon: "Wallet" },
  { href: "/events", label: "Events", icon: "Calendar" },
  { href: "/members", label: "Members", icon: "Users" },
  { href: "/complaints", label: "Complaints", icon: "MessageSquareWarning" },
  { href: "/notices", label: "Notices", icon: "Bell" },
  { href: "/payments", label: "Payments", icon: "CreditCard" },
  { href: "/visitors", label: "Visitors", icon: "UserCheck" },
  { href: "/reports", label: "Reports", icon: "FileBarChart" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];
