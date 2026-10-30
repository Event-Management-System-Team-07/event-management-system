const express = require("express");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const eventBrowseRoutes = require("./routes/eventBrowseRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const logger = require("./utils/logger");

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

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    logger.info("server.listening", { port: Number(PORT) });
  });
}

module.exports = app;
