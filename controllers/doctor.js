import PDFDocument from "pdfkit";
import { Readable } from "stream";
import cloudinary from "../middlewares/cloudinaryConfig.js";
import getStream from 'get-stream'; // Import the get-stream package correctly
import appointment from "../models/appointment.js";
import Prescription from "../models/prescription.js";
import auth from "../models/auth.js";
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

        const doc = new PDFDocument({ margin: 50 });
        doc.font("Helvetica");

        // === HEADER ===
        doc
            .fontSize(10)
            .fillColor("#555")
            .text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 50, 40);

        doc
            .fontSize(16)
            .fillColor("#2C3E50")
            .text("CARECONNECT", { align: "center" });

        doc
            .fontSize(10)
            .fillColor("#555")
            .text("CC", { align: "right" })
            .moveDown(2);

        // === PATIENT & DOCTOR INFO ===
        doc
            .fontSize(12)
            .fillColor("black")
            .text(`Patient Name: ${patname}`)
            .moveDown(0.2)
            .text(`Doctor Name: ${docname}`)
            .moveDown(0.5);

        doc
            .moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .strokeColor("#ccc")
            .lineWidth(1)
            .stroke()
            .moveDown(1);

        // === PRESCRIPTION BOX ===
        doc
            .fontSize(13)
            .fillColor("#2C3E50")
            .text("PRESCRIPTION", { align: "center", underline: true })
            .moveDown(0.5);

        // Draw light gray box
        const startY = doc.y;
        doc
            .rect(50, startY, 500, 20 + (details.length * 55)) // adjust height
            .fillOpacity(0.05)
            .fill("#3498db")
            .fillOpacity(1)
            .stroke("#2980b9");

        doc
            .fillColor("black")
            .fontSize(12)
            .text("Details:", 60, startY + 10);

        // Prescription list
        if (Array.isArray(details) && details.length > 0) {
            let yPos = startY + 30;
            details.forEach((item, index) => {
                doc
                    .fontSize(11)
                    .fillColor("black")
                    .text(`${index + 1}. Medicine: ${item.medicine || "-"}`, 70, yPos)
                    .text(`Dose: ${item.dose || "-"}`, 100, (yPos += 15))
                    .text(`Tip: ${item.tip || "-"}`, 100, (yPos += 15));
                yPos += 10;
            });
        } else {
            doc.text("No prescription details provided.", 70, startY + 30);
        }

        // === FOOTER SECTION ===
        doc
            .moveDown(4)
            .moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .strokeColor("#ccc")
            .stroke();

        doc
            .fontSize(12)
            .fillColor("black")
            .text("Receiver's Signature: ____________________", 50, doc.y + 20);

        doc
            .text("Doctor's Signature: ____________________", 350, doc.y + 20, {
                align: "right",
            });

        doc
            .fontSize(8)
            .fillColor("#999")
            .text("CARECONNECT Healthcare System", 50, doc.y + 50, { align: "center" });
        //////////////////////////////

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


const markAppointmentCompleted = async(req, res) => {

    try {
        const { aptid } = req.body;
        console.log(aptid)
        const apt = await appointment.findOne({ aptid });
        if (!apt) {
            return res.status(404).json({ msg: "Appointment not found" });
        }

        apt.completed = true;
        await apt.save();

        res.status(200).json({ msg: "Appointment marked as completed" });
    } catch (error) {
        res.status(500).json({ msg: "Server error", error });
    }
};

const generateDoctorStats = async(req, res) => {
    try {
        const { uid } = req.body;

        // Get doctor profile
        const doctor = await auth.findOne({ uid, userType: "Doctor" });
        if (!doctor) return res.status(404).json({ error: true, msg: "Doctor not found" });

        const docid = doctor.uid;

        // Get all completed appointments of this doctor
        const completedAppointments = await appointment.find({
            docid,
            completed: true,
        });

        const totalAppointments = completedAppointments.length;

        // Total unique patients consulted
        const uniquePatients = new Set(completedAppointments.map((apt) => apt.patid)).size;

        // Total earnings
        const totalEarnings = completedAppointments.reduce((sum, apt) => sum + (apt.fee || 0), 0);

        // Ratings & Feedback
        const feedbackAppointments = await appointment.find({ docid, feedback: true });
        const feedbackCount = feedbackAppointments.length;

        const averageRating =
            feedbackCount > 0 ?
            (feedbackAppointments.reduce((sum, apt) => sum + (apt.rating || 0), 0) / feedbackCount).toFixed(1) :
            "No ratings";

        const responseArray = [
            { subheading: "Doctor Name", heading: `${doctor.fname} ${doctor.lname}` },
            { subheading: "Speciality", heading: doctor.speciality },
            { subheading: "Appointments Fulfilled", heading: totalAppointments },
            { subheading: "Unique Patients Consulted", heading: uniquePatients },
            { subheading: "Total Revenue Generated", heading: `₹ ${totalEarnings}` },
            { subheading: "Feedbacks Received", heading: feedbackCount },
            { subheading: "Average Rating", heading: averageRating },
        ];

        return res.status(200).json(responseArray);
    } catch (error) {
        console.error("Doctor Stats Error:", error);
        return res.status(500).json({ error: true, errorMsg: "Internal Server Error!" });
    }
};

// exports

export { docAppointments, uploadPrescription, docFeedbacks, doctorPrescriptions, markAppointmentCompleted, generateDoctorStats };