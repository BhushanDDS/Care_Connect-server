import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import auth from "../models/auth.js";
import token from "../models/token.js";

const saltRounds = 10;
const { ACCESS_SECRET, REFRESH_SECRET } = process.env;

// ---------------------> SignUp <-------------------------------

const signup = async(req, res) => {
    try {
        const foundEmail = await auth.findOne({ email: req.body.email });

        if (foundEmail) {
            return res.status(400).json({
                error: true,
                errorMsg: "That email is already registered!",
            });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

        await auth.create({
            ...req.body,
            password: hashedPassword,
        });

        return res.status(201).json({ error: false, msg: "Signup Successful!" });
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: true, errorMsg: "Internal Server Error!" });
    }
};

// ---------------------> SignIn <-------------------------------

const signin = async(req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;

        const foundUser = await auth.findOne({ email: email });

        if (!foundUser) {
            return res
                .status(404)
                .json({ error: true, errorMsg: "Email not registered." });
        }

        if (!foundUser.verified) {
            return res.status(400).json({
                error: true,
                errorMsg: "This email is not verified by the Admin. Please login after the verification process is completed.",
            });
        }

        const result = await bcrypt.compare(password, foundUser.password);

        if (result === true) {
            const accessToken = await foundUser.createAccessToken(foundUser);
            const refreshToken = await foundUser.createRefreshToken(foundUser);
            return res.status(201).json({
                error: false,
                userType: foundUser.userType,
                accessToken,
                refreshToken,
            });
        } else {
            return res
                .status(400)
                .json({ error: true, errorMsg: "Incorrect Password!" });
        }
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: true, errorMsg: "Internal Server Error!" });
    }
};

// ---------------------> Refresh Token <-------------------------------

const generateRefreshToken = async(req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res
                .status(403)
                .json({ error: true, errorMsg: "Access denied, token missing!" });
        }

        const storedToken = await token.findOne({ token: refreshToken });

        if (!storedToken) {
            return res.status(401).json({ error: true, errorMsg: "Token Expired!" });
        }

        const payload = jwt.verify(storedToken.token, REFRESH_SECRET);
        const accessToken = jwt.sign(payload, ACCESS_SECRET);

        return res.status(200).json({ accessToken });
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: true, errorMsg: "Internal Server Error!" });
    }
};

// ---------------------> LogOut <-------------------------------

const logout = async(req, res) => {
    try {
        const { refreshToken } = req.body;
        await token.findOneAndDelete({ token: refreshToken });
        return res
            .status(200)
            .json({ error: false, msg: "Logged Out successfully!" });
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: true, errorMsg: "Internal Server Error!" });
    }
};


const resetPassword = async(req, res) => {
    const { email, currentPassword, newPassword } = req.body;

    try {
        const user = await auth.findOne({ email });
        if (!user) return res.status(404).json({ msg: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ msg: "Current password is incorrect" });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        await user.save();

        res.status(200).json({ msg: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ msg: "Server error", error });
    }
};
// Exports

export { signup, signin, generateRefreshToken, logout, resetPassword };