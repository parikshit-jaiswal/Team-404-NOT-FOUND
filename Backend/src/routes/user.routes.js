import { Router } from "express";
import { registerUser, loginUser, logoutUser, refreshAccessToken, bookAppointment } from '../controllers/user.controller.js'
import { upload } from './../middlewares/multer.middleware.js';
import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();

router.route("/register").post(registerUser);

router.route("/login").post(loginUser);

router.route("/book-appointment").post(verifyJWT, bookAppointment);

// secure route
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);

export default router;