const express = require("express");
const authRoutes = require("./routes/authRoutes");
const { rejectUnsafeInput, handleBodyParseErrors } = require("./middleware/inputValidation");

const app = express();

app.use(express.json());
app.use(rejectUnsafeInput);

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "OK"
    });
});
app.use("/api/auth", authRoutes);

// Must stay AFTER the routes: turns bad-JSON / too-large body errors into clean JSON responses
app.use(handleBodyParseErrors);

module.exports = app;