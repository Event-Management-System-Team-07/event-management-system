const express = require("express");
const authRoutes = require("./routes/authRoutes"); 

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "OK"
    });
});
app.use("/api/auth", authRoutes); 
module.exports = app;