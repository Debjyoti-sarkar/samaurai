// Mock transaction data for TransactionHistoryScreen

export type Transaction = {
  id: string;
  type: "sent" | "received" | "refund" | "failed";
  amount: number;
  recipient?: string;
  sender?: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
  note?: string;
};

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "tx001",
    type: "sent",
    amount: 500,
    recipient: "Rahul Sharma",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    note: "Lunch payment"
  },
  {
    id: "tx002",
    type: "received",
    amount: 1200,
    sender: "Priya Patel",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    note: "Rent contribution"
  },
  {
    id: "tx003",
    type: "sent",
    amount: 250,
    recipient: "Amit Kumar",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: "completed"
  },
  {
    id: "tx004",
    type: "received",
    amount: 800,
    sender: "Sunita Devi",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    note: "Payment for services"
  },
  {
    id: "tx005",
    type: "sent",
    amount: 150,
    recipient: "Local Store",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed"
  },
  {
    id: "tx006",
    type: "failed",
    amount: 2000,
    recipient: "Online Shop",
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    status: "failed",
    note: "Insufficient balance"
  },
  {
    id: "tx007",
    type: "refund",
    amount: 350,
    sender: "E-commerce Platform",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    note: "Order cancelled"
  },
  {
    id: "tx008",
    type: "sent",
    amount: 1500,
    recipient: "Utility Bill",
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    note: "Electricity payment"
  },
];
