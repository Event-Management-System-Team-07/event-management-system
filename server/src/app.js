const express = require("express");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const eventBrowseRoutes = require("./routes/eventBrowseRoutes");
const registrationRoutes = require("./routes/registrationRoutes");

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events", eventBrowseRoutes);
app.use("/api/events", registrationRoutes);

module.exports = app;