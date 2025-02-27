const jwt = require("jsonwebtoken");
const Users = require("../model/users");
const httpCode = require("../helpers/httpCode");
const EmailService = require("../services/email");
const { saveUserAvatar } = require("../helpers/saveUserAvatar");

require("dotenv").config();

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

const signupUser = async (req, res, next) => {
  try {
    const user = await Users.findUserByEmail(req.body.email);
    if (user) {
      return res.status(httpCode.CONFLICT).json({
        status: "conflict",
        code: httpCode.CONFLICT,
        message: "Email in use",
      });
    }
    const newUser = await Users.createUser(req.body);
    const { name, email, subscription, verifyToken } = newUser;
    try {
      const emailService = new EmailService(process.env.NODE_ENV);
      await emailService.sendVerifyEmail(verifyToken, email, name);
    } catch (error) {
      console.log(error.message);
    }
    return res.status(httpCode.CREATED).json({
      status: "created",
      code: httpCode.CREATED,
      data: {
        email,
        subscription,
      },
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const user = await Users.findUserByEmail(req.body.email);
    const isValidPassword = await user?.validatePassword(req.body.password);
    if (!user || !isValidPassword || !user.verify) {
      return res.status(httpCode.UNAUTHORIZED).json({
        status: "error",
        code: httpCode.UNAUTHORIZED,
        message: "Invalid credential",
      });
    }
    const payload = { id: user._id };
    const token = jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: "2h" });
    await Users.updateToken(user._id, token);
    return res.status(httpCode.OK).json({
      status: "success",
      code: httpCode.OK,
      data: {
        token,
        user: { email: user.email, subscription: user.subscription },
      },
    });
  } catch (error) {
    next(error);
  }
};

const logoutUser = async (req, res, next) => {
  try {
    const id = req.user.id;
    await Users.updateToken(id, null);
    return res.status(httpCode.NO_CONTENT).json({});
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    const {
      user: { email, subscription },
    } = req;
    return res.status(httpCode.OK).json({
      status: "success",
      code: httpCode.OK,
      data: { email, subscription },
    });
  } catch (error) {
    next(error);
  }
};

const updateSubscriptionUser = async (req, res, next) => {
  try {
    const {
      user: { _id },
      body: { subscription },
    } = req;

    const user = await Users.updateSubscription(_id, subscription);
    return res.status(httpCode.OK).json({
      status: "success",
      code: httpCode.OK,
      data: { email: user.email, subscription: user.subscription },
    });
  } catch (error) {
    next(error);
  }
};

const updateAvatar = async (req, res, next) => {
  try {
    const { id, email, subscription } = req.user;
    const avatarURL = await saveUserAvatar(req);
    await Users.updateAvatar(id, avatarURL);

    return res.status(httpCode.OK).json({
      status: "success",
      code: httpCode.OK,
      data: { email, subscription, avatarURL },
    });
  } catch (error) {
    next(error);
  }
};

const emailVerify = async (req, res, next) => {
  try {
    const user = await Users.findUserByVerifyToken(req.params.token);
    if (!user) {
      return res.status(httpCode.NOT_FOUND).json({
        status: "fail",
        code: httpCode.NOT_FOUND,
        message: "User not found",
      });
    }
    await Users.updateVerifyToken(user.id, true, null);
    return res.status(httpCode.OK).json({
      status: "success",
      code: httpCode.OK,
      message: "Verification successful",
    });
  } catch (error) {
    next(error);
  }
};

const repeatEmailVerify = async (req, res, next) => {
  try {
    const user = await Users.findUserByVerifyToken(req.params.token);
    if (!user) {
      return res.status(httpCode.NOT_FOUND).json({
        status: "fail",
        code: httpCode.NOT_FOUND,
        message: "User not found",
      });
    }
    if (user.verify) {
      return res.status(httpCode.BAD_REQUEST).json({
        status: "fail",
        code: httpCode.BAD_REQUEST,
        message: "Verification has already been passed",
      });
    }
    const { verifyToken, email, name } = user;
    const emailService = new EmailService(process.env.NODE_ENV);
    await emailService.sendVerifyEmail(verifyToken, email, name);
    return res.status(httpCode.OK).json({
      status: "success",
      code: httpCode.OK,
      message: "Verification email sent",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signupUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  updateSubscriptionUser,
  updateAvatar,
  emailVerify,
  repeatEmailVerify,
};
