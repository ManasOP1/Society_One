export type PaymentStatus = "Paid" | "Pending" | "Failed";
export type ComplaintStatus = "Open" | "In Progress" | "Resolved" | "Rejected";
export type Priority = "Low" | "Medium" | "High" | "Critical";

export const societyInfo = {
  name: "Green Valley Residency",
  adminName: "Society Admin",
  adminRole: "Admin",
  totalMembers: 153,
  occupiedFlats: 128,
  totalFlats: 150,
  societyFund: 1845000,
  activeEvents: 3,
  pendingMaintenance: 215000,
  collectionTarget: 2000000,
  collected: 1720000,
};

export const financialData = [
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
];

export const membersByAge = [
  { name: "Children", value: 28, color: "#a78bfa" },
  { name: "Adults", value: 95, color: "#fb923c" },
  { name: "Senior Citizens", value: 30, color: "#6ee7b7" },
];

export const ownersVsTenants = [
  { name: "Owners", value: 98, color: "#4f46e5" },
  { name: "Tenants", value: 55, color: "#38bdf8" },
];

export const upcomingEvents = [
  { id: 1, title: "Ganesh Festival", date: "15 Sept", color: "purple" },
  { id: 2, title: "AGM Meeting", date: "22 Sept", color: "orange" },
  { id: 3, title: "Blood Donation Camp", date: "28 Sept", color: "mint" },
];

export const calendarEvents = [
  { date: 15, type: "event" as const, label: "Ganesh Festival" },
  { date: 22, type: "event" as const, label: "AGM Meeting" },
  { date: 28, type: "event" as const, label: "Blood Donation" },
  { date: 10, type: "maintenance" as const, label: "Maintenance Due" },
  { date: 5, type: "maintenance" as const, label: "Late Fee" },
];

export const recentPayments = [
  {
    id: 1,
    flat: "A-203",
    name: "Rahul Patil",
    amount: 2500,
    status: "Paid" as PaymentStatus,
    avatar: "RP",
  },
  {
    id: 2,
    flat: "B-105",
    name: "Priya Sharma",
    amount: 2500,
    status: "Pending" as PaymentStatus,
    avatar: "PS",
  },
  {
    id: 3,
    flat: "C-412",
    name: "Amit Desai",
    amount: 3200,
    status: "Paid" as PaymentStatus,
    avatar: "AD",
  },
  {
    id: 4,
    flat: "A-118",
    name: "Sneha Joshi",
    amount: 2500,
    status: "Failed" as PaymentStatus,
    avatar: "SJ",
  },
  {
    id: 5,
    flat: "D-301",
    name: "Vikram Mehta",
    amount: 2800,
    status: "Paid" as PaymentStatus,
    avatar: "VM",
  },
];

export const latestComplaints = [
  {
    id: 1,
    resident: "Michael Smith",
    flat: "B-302",
    issue: "Water Leakage",
    priority: "High" as Priority,
    status: "Open" as ComplaintStatus,
  },
  {
    id: 2,
    resident: "Peter Johns",
    flat: "A-101",
    issue: "Lift Not Working",
    priority: "Critical" as Priority,
    status: "In Progress" as ComplaintStatus,
  },
  {
    id: 3,
    resident: "Anita Rao",
    flat: "C-205",
    issue: "Parking Dispute",
    priority: "Medium" as Priority,
    status: "Open" as ComplaintStatus,
  },
  {
    id: 4,
    resident: "Karan Shah",
    flat: "D-110",
    issue: "Noise Complaint",
    priority: "Low" as Priority,
    status: "Resolved" as ComplaintStatus,
  },
];

export const activities = [
  {
    id: 1,
    title: "Maintenance Paid",
    description: "Rahul Patil paid ₹2,500 for A-203",
    time: "2 min ago",
    type: "payment" as const,
  },
  {
    id: 2,
    title: "Visitor Approved",
    description: "Guest for B-105 approved by Priya",
    time: "15 min ago",
    type: "visitor" as const,
  },
  {
    id: 3,
    title: "Complaint Closed",
    description: "Noise complaint D-110 resolved",
    time: "1 hour ago",
    type: "complaint" as const,
  },
  {
    id: 4,
    title: "Notice Published",
    description: "Water supply interruption notice",
    time: "3 hours ago",
    type: "notice" as const,
  },
  {
    id: 5,
    title: "Event Created",
    description: "Ganesh Festival scheduled for 15 Sept",
    time: "5 hours ago",
    type: "event" as const,
  },
];

export const notices = [
  {
    id: 1,
    title: "Water Supply Interruption",
    date: "14 Jul 2026",
    excerpt: "Water supply will be interrupted on 18th July from 10 AM to 2 PM for tank cleaning.",
  },
  {
    id: 2,
    title: "AGM Meeting Reminder",
    date: "12 Jul 2026",
    excerpt: "Annual General Meeting scheduled for 22nd September in the clubhouse.",
  },
  {
    id: 3,
    title: "Parking Slot Reallocation",
    date: "10 Jul 2026",
    excerpt: "New parking allocation list has been published. Please check your assigned slots.",
  },
];

export const members = [
  {
    id: 1,
    photo: "RP",
    flat: "A-203",
    owner: "Rahul Patil",
    tenant: "—",
    phone: "+91 98765 43210",
    email: "rahul.patil@email.com",
    parking: "P-12",
    maintenance: "Paid" as PaymentStatus,
  },
  {
    id: 2,
    photo: "PS",
    flat: "B-105",
    owner: "Suresh Sharma",
    tenant: "Priya Sharma",
    phone: "+91 98765 43211",
    email: "priya.sharma@email.com",
    parking: "P-24",
    maintenance: "Pending" as PaymentStatus,
  },
  {
    id: 3,
    photo: "AD",
    flat: "C-412",
    owner: "Amit Desai",
    tenant: "—",
    phone: "+91 98765 43212",
    email: "amit.desai@email.com",
    parking: "P-08",
    maintenance: "Paid" as PaymentStatus,
  },
  {
    id: 4,
    photo: "SJ",
    flat: "A-118",
    owner: "Sneha Joshi",
    tenant: "—",
    phone: "+91 98765 43213",
    email: "sneha.joshi@email.com",
    parking: "P-31",
    maintenance: "Failed" as PaymentStatus,
  },
  {
    id: 5,
    photo: "VM",
    flat: "D-301",
    owner: "Vikram Mehta",
    tenant: "Ravi Kumar",
    phone: "+91 98765 43214",
    email: "vikram.mehta@email.com",
    parking: "P-45",
    maintenance: "Paid" as PaymentStatus,
  },
  {
    id: 6,
    photo: "AR",
    flat: "C-205",
    owner: "Anita Rao",
    tenant: "—",
    phone: "+91 98765 43215",
    email: "anita.rao@email.com",
    parking: "P-19",
    maintenance: "Pending" as PaymentStatus,
  },
  {
    id: 7,
    photo: "KS",
    flat: "D-110",
    owner: "Karan Shah",
    tenant: "—",
    phone: "+91 98765 43216",
    email: "karan.shah@email.com",
    parking: "P-52",
    maintenance: "Paid" as PaymentStatus,
  },
  {
    id: 8,
    photo: "NG",
    flat: "B-220",
    owner: "Neha Gupta",
    tenant: "Meera Iyer",
    phone: "+91 98765 43217",
    email: "neha.gupta@email.com",
    parking: "P-07",
    maintenance: "Paid" as PaymentStatus,
  },
];

export const financeSummary = [
  { label: "Monthly Maintenance", amount: 172000, type: "income" as const },
  { label: "Late Fees", amount: 12500, type: "income" as const },
  { label: "Penalty", amount: 4500, type: "income" as const },
  { label: "Other Income", amount: 28000, type: "income" as const },
  { label: "Utilities", amount: 85000, type: "expense" as const },
  { label: "Vendor Payments", amount: 42000, type: "expense" as const },
  { label: "Security", amount: 35000, type: "expense" as const },
  { label: "Maintenance Staff", amount: 28000, type: "expense" as const },
];

export const events = [
  {
    id: 1,
    title: "Ganesh Festival",
    date: "15 Sept 2026",
    endDate: "17 Sept 2026",
    location: "Society Courtyard",
    budget: 75000,
    rsvp: 89,
    status: "Upcoming",
  },
  {
    id: 2,
    title: "AGM Meeting",
    date: "22 Sept 2026",
    endDate: "22 Sept 2026",
    location: "Clubhouse Hall",
    budget: 15000,
    rsvp: 112,
    status: "Upcoming",
  },
  {
    id: 3,
    title: "Blood Donation Camp",
    date: "28 Sept 2026",
    endDate: "28 Sept 2026",
    location: "Community Center",
    budget: 20000,
    rsvp: 45,
    status: "Upcoming",
  },
  {
    id: 4,
    title: "Independence Day",
    date: "15 Aug 2026",
    endDate: "15 Aug 2026",
    location: "Main Gate Lawn",
    budget: 30000,
    rsvp: 130,
    status: "Completed",
  },
];

export const visitors = [
  {
    id: 1,
    name: "Ramesh Kumar",
    flat: "A-203",
    vehicle: "MH-12-AB-1234",
    expectedTime: "Today, 4:00 PM",
    status: "Pending",
    purpose: "Personal Visit",
  },
  {
    id: 2,
    name: "Delivery - Amazon",
    flat: "B-105",
    vehicle: "—",
    expectedTime: "Today, 2:30 PM",
    status: "Approved",
    purpose: "Parcel Delivery",
  },
  {
    id: 3,
    name: "Sunita Devi",
    flat: "C-412",
    vehicle: "MH-14-CD-5678",
    expectedTime: "Tomorrow, 10:00 AM",
    status: "Approved",
    purpose: "Domestic Help",
  },
  {
    id: 4,
    name: "Electrician - Vijay",
    flat: "D-301",
    vehicle: "MH-12-EF-9012",
    expectedTime: "Today, 11:00 AM",
    status: "Checked In",
    purpose: "Repair Work",
  },
];

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
