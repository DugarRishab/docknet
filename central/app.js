// central/app.js

const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/apiRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Optional: health check
app.get("/", (req, res) => {
	res.send("Central Node is running 🚀");
});

// API routes
app.use("/api", apiRoutes);

module.exports = app;
