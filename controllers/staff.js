import auth from "../models/auth.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";
import dotenv from "dotenv";

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


export { findPatient, regNewUser };