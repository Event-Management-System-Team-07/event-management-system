const express = require("express");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const eventBrowseRoutes = require("./routes/eventBrowseRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const adminEventRoutes = require("./routes/adminEventRoutes");

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
app.use("/api/admin/events", adminEventRoutes);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
