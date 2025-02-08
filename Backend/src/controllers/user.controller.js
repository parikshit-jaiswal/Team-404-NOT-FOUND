import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";
import Appointment from "../models/appointment.model.js";

// Generate access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Error generating tokens:", error);
        return res.status(500).json({ success: false, message: "Something went wrong while generating access and refresh tokens" });
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields (fullName, email, and password) are required" });
    }


    let baseUsername = fullName.toLowerCase().replace(/\s+/g, "");
    let username = baseUsername;
    let isUsernameTaken = await User.findOne({ username });

    while (isUsernameTaken) {
        const randomNumber = Math.floor(1000 + Math.random() * 9000);
        username = `${baseUsername}${randomNumber}`;
        isUsernameTaken = await User.findOne({ username });
    }


    const existedUser = await User.findOne({ email });
    if (existedUser) {
        return res.status(409).json({ success: false, message: "User with this email already exists" });
    }

    const user = await User.create({
        fullName,
        username,
        email,
        password
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        return res.status(500).json({ success: false, message: "Something went wrong while registering the user" });
    }

    return res.status(201).json({
        success: true,
        data: createdUser,
        message: "User registered successfully"
    });
});



const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ success: false, message: "User doesn't exist" });
    }

    const isPasswordvalid = await user.isPasswordCorrect(password);

    if (!isPasswordvalid) {
        return res.status(401).json({ success: false, message: "Incorrect user credentials" });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully"));
});

// Logout User
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: undefined } }, { new: true });

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Refresh Access Token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        return res.status(401).json({ success: false, message: "Unauthorized request" });
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid refresh token" });
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            return res.status(401).json({ success: false, message: "Refresh token is expired or used" });
        }

        const options = {
            httpOnly: true,
            secure: true
        };

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            );
    } catch (error) {
        return res.status(401).json({ success: false, message: error?.message || "Invalid refresh token" });
    }
});

// Change Current Password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "Current password and new password are required" });
    }

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

    if (!isPasswordCorrect) {
        return res.status(401).json({ success: false, message: "Incorrect current password" });
    }

    user.password = newPassword;

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

// Get Current User
const getCurrentUser = asyncHandler(async (req, res) => {
    const user = req.user;
    return res.status(200).json(new ApiResponse(200, user, "User details fetched successfully"));
});

// Update User
const updateUser = asyncHandler(async (req, res) => {
    const user = req.user;
    const { fullName, email, username } = req.body;

    if (!fullName && !email && !username) {
        return res.status(400).json({ success: false, message: "User details are required" });
    }

    if (email) {
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            return res.status(409).json({ success: false, message: "Email is already taken" });
        }
    }

    if (username) {
        const existingUser = await User.findOne({ username });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            return res.status(409).json({ success: false, message: "Username is already taken" });
        }
    }

    if (email) user.email = email;
    if (fullName) user.fullName = fullName;
    if (username) user.username = username;

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, user, "User details updated successfully"));
});

// Update User Avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        return res.status(400).json({ success: false, message: "Avatar file is missing" });
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        return res.status(400).json({ success: false, message: "Error while uploading Avatar" });
    }

    const user = await User.findByIdAndUpdate(user?._id,
        {
            $set: {
                avatar: avatar?.url
            }
        }, { new: true }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));
});

// Update User Cover Image
const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        return res.status(400).json({ success: false, message: "Cover Image file is missing" });
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        return res.status(400).json({ success: false, message: "Error while uploading Cover Image" });
    }

    const user = await User.findByIdAndUpdate(user?._id,
        {
            $set: {
                coverImage: coverImage?.url
            }
        }, { new: true }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, user, "Cover Image updated successfully"));
});


const bookAppointment = asyncHandler(async (req, res) => {
    try {
        const { appointmentDate, reason } = req.body;
        const userId = req.user._id;

        if (!userId || !appointmentDate || !reason) {
            return res
                .status(400)
                .json(new ApiResponse(400, null, "All fields are required"));
        }

        const user = await User.findById(userId);
        if (!user) {
            return res
                .status(404)
                .json(new ApiResponse(404, null, "User not found"));
        }

        const currentDate = new Date();
        const appointmentDateTime = new Date(appointmentDate);

        if (appointmentDateTime < currentDate) {
            return res
                .status(400)
                .json(new ApiResponse(400, null, "Appointment date must be in the future"));
        }

        // const overlappingAppointment = await Appointment.findOne({
        //     doctor: doctorId,
        //     appointmentDate: appointmentDateTime,
        // });

        // if (overlappingAppointment) {
        //     return res
        //         .status(409)
        //         .json(new ApiResponse(409, null, "The selected time slot is already booked"));
        // }

        const appointment = await Appointment.create({
            user: userId,
            appointmentDate: appointmentDateTime,
            reason,
        });

        return res
            .status(201)
            .json(new ApiResponse(201, appointment, "Appointment booked successfully"));
    } catch (error) {
        return res
            .status(500)
            .json(new ApiResponse(500, null, "Internal Server Error"));
    }
});


export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateUser, updateUserAvatar, updateUserCoverImage, bookAppointment };
