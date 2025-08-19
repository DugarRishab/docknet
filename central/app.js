// central/app.js
const express = require('express');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const errorController = require('./controllers/errorController');

const apiRoutes = require('./routes/apiRoutes');

const app = express();

dotenv.config({ path: "./config.env" });

app.enable("trust proxy");

console.log((`ENV = ${process.env.NODE_ENV}`));
app.use(morgan('dev')); // <- Logs res status code and time taken

app.use(cors());
app.use(express.json());


app.use(express.json({ limit: "1gb" })); // <- Parses Json data
app.use(express.urlencoded({ extended: true, limit: "100mb" })); // <- Parses URLencoded data
app.use(cookieParser());
app.use(mongoSanitize()); // <- Data Sanitization aganist NoSQL query Injection.
app.use(xss()); // <- Data Sanitization against xss

app.use(compression());

// API routes
app.get("/", (req, res) => {
	res.send("Central Node is running 🚀");
});

app.use("/api", apiRoutes);

app.all("*", (req, res, next) => {
	// <- Middleware to handle Non-existing Routes
	next(new AppError(`Can't find ${req.originalUrl} on the server`, 404));
});

app.use(errorController); // <- Error Handling Middleware

module.exports = app;
