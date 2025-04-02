import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    aptid: { type: String, required: true },
    patid: { type: String, required: true },
    docid: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    paymentMethod: String,
    transactionId: String,
    date: { type: Date, default: Date.now },
});

export default mongoose.model("Payment", paymentSchema);