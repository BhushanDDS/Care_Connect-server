import PDFDocument from "pdfkit";
import { Readable } from "stream";
import cloudinary from "../middlewares/cloudinaryConfig.js";
// import { v2 as cloudinary } from "cloudinary";
import appointment from "../models/appointment.js";
import Prescription from "../models/prescription.js";
// import { ref, getDownloadURL, uploadBytesResumable } from "firebase/storage";
// import { storage } from "../firebase-config.js";

// -----------------> Upcoming Appointments <-------------------

const docAppointments = async(req, res) => {
    try {
        const { docid } = req.body;
        const appointments = await appointment.find({ docid, payment: true });
        if (appointments.length > 0) {
            const filteredAppointments = appointments.filter((appointment) => {
                const appointmentDate = new Date(appointment.doa);
                const appointmentYear = appointmentDate.getFullYear();
                const appointmentMonth = appointmentDate.getMonth();
                const appointmentDay = appointmentDate.getDate();

                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();
                const currentDay = currentDate.getDate();

                if (
                    appointmentYear > currentYear ||
                    (appointmentYear === currentYear &&
                        (appointmentMonth > currentMonth ||
                            (appointmentMonth === currentMonth &&
                                appointmentDay >= currentDay)))
                ) {
                    return true;
                } else {
                    return false;
                }
            });

            if (filteredAppointments.length > 0) {
                return res.status(200).json(filteredAppointments);
            } else {
                return res
                    .status(404)
                    .json({ error: true, errorMsg: "No upcoming appointments." });
            }
        } else {
            return res
                .status(404)
                .json({ error: true, errorMsg: "No upcoming appointments." });
        }
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: true, errorMsg: "Internal Server Error!" });
    }
};

// -------------------------> Upload Prescription to Firebase <----------------------


const uploadPrescription = async(req, res) => {
    try {
        // Generate unique filename
        const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
        const fileName = `prescriptions/${uniqueSuffix}_prescription.pdf`;

        // Create a PDF document in memory
        const doc = new PDFDocument();
        const buffers = [];

        doc.on("data", buffers.push.bind(buffers));

        doc.on("end", async() => {
            const pdfBuffer = Buffer.concat(buffers);

            // Convert buffer to stream for Cloudinary
            const stream = Readable.from(pdfBuffer);

            // Upload to Cloudinary
            const uploadStream = cloudinary.uploader.upload_stream({ resource_type: "raw", folder: "prescriptions", public_id: fileName },
                async(error, result) => {
                    if (error) {
                        console.error("Cloudinary Upload Error:", error);
                        return res.status(500).json({ error: true, errorMsg: "File upload failed!" });
                    }

                    // Save prescription in MongoDB
                    const pr = req.body;
                    pr.prescribed = true;
                    pr.file = result.secure_url;
                    pr.pdate = new Date().toLocaleString("en-US", {
                        timeZone: "Asia/Kolkata",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    });

                    await Prescription.create(pr);

                    return res.status(201).json({
                        error: false,
                        msg: "Prescription Generated & Uploaded Successfully.",
                        fileURL: result.secure_url,
                    });
                }
            );

            // Pipe stream to Cloudinary upload
            stream.pipe(uploadStream);
        });

        // Write PDF content
        doc.fontSize(18).text("Prescription", { align: "center" }).moveDown();
        doc.fontSize(14).text(`Patient Name: ${req.body.patname}`);
        doc.text(`Doctor Name: ${req.body.docname}`);
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.text(`Prescription Details:\n${req.body.details || "No details provided."}`);
        doc.end();
    } catch (error) {
        console.error(error);
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

// exports

export { docAppointments, uploadPrescription, docFeedbacks };