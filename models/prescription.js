import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
    aptid: String,
    patid: String,
    docid: String,
    patname: String,
    docname: String,
    date: String,
    pdate: String,
    prescribed: {
        type: Boolean,
        default: false,
    },
    file: {
        type: String,
        default: "",
    },
});

export default mongoose.model("Prescription", prescriptionSchema);