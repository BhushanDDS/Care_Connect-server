import PDFDocument from "pdfkit";
import { Readable } from "stream";
import cloudinary from "../middlewares/cloudinaryConfig.js";
import getStream from 'get-stream'; // Import the get-stream package correctly
import appointment from "../models/appointment.js";
import Prescription from "../models/prescription.js";
// import { ref, getDownloadURL, uploadBytesResumable } from "firebase/storage";
// import { storage } from "../firebase-config.js";

// -----------------> Upcoming Appointments <-------------------

const docAppointments = async(req, res) => {
    try {
        const { docid } = req.body;

        // Fetch upcoming appointments directly from MongoDB
        const appointments = await appointment.find({
            docid,
            paymentId: { $ne: null }, // Ensures payment is completed
            doa: { $gte: new Date().toISOString().split("T")[0] }, // Filter future appointments
        }).exec();

        if (appointments.length > 0) {
            return res.status(200).json(appointments);
        } else {
            return res.status(404).json({ error: true, errorMsg: "No upcoming appointments." });
        }
    } catch (error) {
        console.error("Error fetching appointments:", error);
        return res.status(500).json({ error: true, errorMsg: "Internal Server Error!" });
    }
};


// -------------------------> Upload Prescription to Firebase <----------------------

const uploadPrescription = async(req, res) => {
    try {
        const { aptid, patid, docid, patname, docname, details } = req.body;

        // Validate required fields
        if (!aptid || !patid || !docid || !patname || !docname) {
            return res.status(400).json({ error: true, msg: "Missing required fields." });
        }

        const fileName = `prescriptions/${Date.now()}_${Math.round(Math.random() * 1e9)}_prescription`;

        // Create PDF document
        const doc = new PDFDocument();
        doc.fontSize(20).fillColor("black").text(" Prescription", { align: "center" }).moveDown();
        doc.fontSize(14).text(` Patient Name: ${patname}`);
        doc.text(`Patient ID: ${patid}`);
        doc.text(` Doctor Name: ${docname}`);
        doc.text(` Date: ${new Date().toLocaleDateString("en-IN")}`);
        doc.moveDown();
        doc.fontSize(12).text(` Prescription Details:\n${details || "No details provided."}`);

        // Create buffers array to collect PDF data
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));

        // Handle PDF completion
        const pdfBufferPromise = new Promise((resolve, reject) => {
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
        });

        // End the document to trigger the events
        doc.end();

        // Wait for buffer to be complete
        const pdfBuffer = await pdfBufferPromise;

        // Upload to Cloudinary
        const stream = Readable.from(pdfBuffer);
        const uploadStream = cloudinary.uploader.upload_stream({
                resource_type: "raw",
                folder: "prescriptions",
                public_id: fileName,
                type: "upload",
            },
            async(error, result) => {
                if (error) {
                    console.error("Cloudinary Upload Error:", error);
                    return res.status(500).json({ error: true, errorMsg: "File upload failed!" });
                }

                const pdate = new Date().toLocaleString("en-US", {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });

                // Save to MongoDB
                await Prescription.create({
                    aptid,
                    patid,
                    docid,
                    patname,
                    docname,
                    details,
                    prescribed: true,
                    file: result.secure_url,
                    pdate,
                });

                return res.status(201).json({
                    error: false,
                    msg: "Prescription Generated & Uploaded Successfully.",
                    fileURL: result.secure_url,
                });
            }
        );

        stream.pipe(uploadStream);
    } catch (error) {
        console.error("Error uploading prescription:", error);
        return res.status(500).json({ error: true, errorMsg: "Internal Server Error!" });
    }
};
// -----------------> Return Received Feedbacks <------------------------

const docFeedbacks = async(req, res) => {
    try {
        const { docid } = req.body;
        const appointments = await appointment.find({ docid, feedback: true },
            "-_id patname date feedback review rating"
        );
        if (appointments.length > 0) {
            return res.status(200).json(appointments);
        } else {
            return res
                .status(404)
                .json({ error: true, errorMsg: "No feedback found." });
        }
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: true, errorMsg: "Internal Server Error!" });
    }
};

const doctorPrescriptions = async(req, res) => {
    try {
        const prescriptions = await Prescription.find({
            docid: req.body.docid,
            prescribed: true,
        });

        if (prescriptions.length > 0) {
            return res.status(200).json(prescriptions);
        } else {
            return res
                .status(404)
                .json({ error: true, errorMsg: "No prescriptions found for this doctor!" });
        }
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: true, errorMsg: "Internal Server Error!" });
    }
};


// exports

export { docAppointments, uploadPrescription, docFeedbacks, doctorPrescriptions };