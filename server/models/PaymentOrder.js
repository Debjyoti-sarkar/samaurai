import mongoose from "mongoose";

const paymentOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    recipient: {
      type: String,
      required: true,
      index: true,
    },
    note: {
      type: String,
      default: "",
    },
    contactName: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
      index: true,
    },
    referenceId: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

paymentOrderSchema.index({ createdAt: -1 });

const PaymentOrder =
  mongoose.models.PaymentOrder ||
  mongoose.model("PaymentOrder", paymentOrderSchema);

export default PaymentOrder;
