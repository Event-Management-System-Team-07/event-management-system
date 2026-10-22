const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true
        },

        status: {
            type: String,
            enum: ["active", "cancelled"],
            default: "active",
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Prevent multiple active registrations
// for the same user and event.
registrationSchema.index(
    { user: 1, event: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: "active"
        }
    }
);

module.exports = mongoose.model("Registration", registrationSchema);