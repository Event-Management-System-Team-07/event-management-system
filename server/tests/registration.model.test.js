const Registration = require("../src/models/Registration");

describe("Registration Model", () => {
    test("should have the required fields", () => {
        const registration = new Registration();

        const validationError = registration.validateSync();

        expect(validationError.errors.user).toBeDefined();
        expect(validationError.errors.event).toBeDefined();
    });

    test("should default status to active", () => {
        const registration = new Registration();

        expect(registration.status).toBe("active");
    });

    test("should accept cancelled as a valid status", () => {
        const registration = new Registration({
            status: "cancelled"
        });

        expect(registration.status).toBe("cancelled");
    });

    test("should reject an invalid status", () => {
        const registration = new Registration({
            status: "invalid"
        });

        const validationError = registration.validateSync();

        expect(validationError.errors.status).toBeDefined();
    });

    test("should have timestamps enabled", () => {
        expect(Registration.schema.options.timestamps).toBe(true);
    });
});