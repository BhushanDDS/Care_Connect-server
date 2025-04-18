import auth from "../models/auth.js";
"../models/auth.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";
import dotenv from "dotenv";
import Payment from "../models/payment.js";
import Appointment from "../models/appointment.js";

dotenv.config(); // Load environment variables

console.log("CLOUDINARY_CLOUD_NAME:", process.env.EMAIL);
console.log("CLOUDINARY_API_KEY:", process.env.EMAIL_PASSWORD ? "Loaded" : "Not Loaded");

const findPatient = async(req, res) => {
    try {
        const { email } = req.body;
        const user = await auth.findOne({ email }, "-_id -password -verified");
        if (user) {
            return res.status(200).json(user);
        } else {
            return res
                .status(404)
                .json({ error: true, errorMsg: "Patient not registered!" });
        }
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: true, errorMsg: "Internal Server Error!" });
    }
};

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL, // Your Gmail address
        pass: process.env.EMAIL_PASSWORD, // App password
    },
});

const regNewUser = async(req, res) => {
    try {
        const { fname, lname, email } = req.body;

        // Check if the user already exists
        const existingUser = await auth.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: true, message: "User already registered!" });
        }

        // Generate a random password (4-7 characters)
        const randomPassword = nanoid(Math.floor(Math.random() * 4) + 4);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        // Create a new patient user
        const newUser = new auth({
            userType: "Patient",
            fname,
            lname,
            email,
            password: hashedPassword,
            verified: true, // Patients are verified upon registration
        });

        await newUser.save();

        // Send email with login credentials
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: "Your MedCare Login Credentials",
            text: `Hello ${fname} ${lname},\n\nYour account has been created.\n\nEmail: ${email}\nPassword: ${randomPassword}\n\nPlease log in and change your password immediately.`,
        };

        await transporter.sendMail(mailOptions);

        return res.status(201).json({ message: "Patient registered successfully! Login details sent to email." });
    } catch (error) {
        console.error("Error in regNewUser:", error);
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
};


const acceptPayment = async(req, res) => {
    try {
        const { aptid, paymentMethod, transactionId } = req.body;

        // Check if the appointment exists
        const appointment = await Appointment.findOne({ aptid });
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        // Create a new payment record using the fee from the appointment
        const payment = new Payment({
            aptid,
            patid: appointment.patid,
            docid: appointment.docid,
            amount: appointment.fee, // Use fee from appointment
            paymentMethod,
            transactionId,
            status: "completed",
        });
        await payment.save();

        // Link payment to appointment
        appointment.paymentId = payment._id;
        await appointment.save();

        res.status(200).json({ message: "Payment accepted successfully", payment });
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

const getAllPatients = async(req, res) => {
    try {
        const patients = await auth.find({ userType: "Patient" }).select("-password");
        res.status(200).json(patients);
    } catch (error) {
        console.error("Error fetching patients:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getAppointmentsWithoutPayment = async(req, res) => {
    try {
        const appointments = await Appointment.find({ paymentId: null });
        res.status(200).json(appointments);
    } catch (error) {
        console.error("Error fetching appointments without payment:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



export { findPatient, regNewUser, acceptPayment, getAllPatients, getAppointmentsWithoutPayment };