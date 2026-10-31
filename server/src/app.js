const express = require("express");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const eventBrowseRoutes = require("./routes/eventBrowseRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const adminEventRoutes = require("./routes/adminEventRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// SEC-03: Do not expose Express through response headers.
app.disable("x-powered-by");

// Parse JSON before routes so malformed/oversized JSON reaches errorHandler.
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events", eventBrowseRoutes);
app.use("/api/events", registrationRoutes);
app.use("/api/admin/events", adminEventRoutes);
app.use("/api/notifications", notificationRoutes);

// Unknown routes return JSON instead of Express's default HTML.
app.use(notFound);

// Error handler must be registered last.
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
