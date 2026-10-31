const express = require("express");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const eventBrowseRoutes = require("./routes/eventBrowseRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// SEC-03: do not advertise the framework in the X-Powered-By header
app.disable("x-powered-by");

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
app.use("/api/notifications", notificationRoutes);

// SEC-03: must stay last. Unknown routes and all errors return generic JSON.
app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
