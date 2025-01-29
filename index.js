const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");

// Initialize the app
const app = express();
const port = 5000;
const SECRET_KEY = "my$3cr3tK3yWithSp3ci@lCharacters";

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/busServiceDB", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};
connectDB();

// Middleware
app.use(cors({ origin: "http://localhost:8080", credentials: true }));
app.use(express.json());

// Models
const busServiceSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  busType: { type: String, required: true },
  selectedBus: { type: String, required: true },
  serviceStartPlace: { type: String, required: true },
  serviceEndPlace: { type: String, required: true },
  departureTime: { type: String, required: true },
  arrivalTime: { type: String, required: true },
  seaterPrice: { type: Number, required: true },
  sleeperPrice: { type: Number, required: true },
  totalSeat: { type: Number, required: true },
  lowerDeckSeats: { type: Object, required: true },
  upperDeckSeats: { type: Object, required: true },
});
const BusService = mongoose.model("BusService", busServiceSchema);

const emailSchema = new mongoose.Schema({
  email: { type: String, required: true },
});
const Email = mongoose.model("Email", emailSchema);

const sanitizeEmail = (email) => email.replace(/[^a-zA-Z0-9]/g, "_");
const getUserCollection = (email) => {
  const sanitizedEmail = sanitizeEmail(email);
  const userSchema = new mongoose.Schema(
    {
      data: mongoose.Schema.Types.Mixed,
    },
    { strict: false }
  );
  return mongoose.model(sanitizedEmail, userSchema, sanitizedEmail);
};

// Controllers
const getBusServices = async (req, res) => {
  try {
    const busServices = await BusService.find();
    res.json(busServices);
  } catch (err) {
    res.status(500).json({ message: "Error retrieving data", error: err });
  }
};

const addBusService = async (req, res) => {
  const newBusService = new BusService(req.body);

  try {
    await newBusService.save();
    res.json({ message: "Bus service data saved successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Error saving data", error: err });
  }
};

const login = async (req, res) => {
  const { email } = req.body;
  try {
    const existingEmail = await Email.findOne({ email });
    const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: "1h" });

    res.cookie("authToken", token, { httpOnly: false, secure: false });

    if (existingEmail) {
      return res.json({ message: "Email already exists in the collection." });
    }

    const newEmail = new Email({ email });
    await newEmail.save();

    getUserCollection(email);
    res.json({ message: "Email added to the collection successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Error processing login", error: err });
  }
};

const saveTicket = async (req, res) => {
  const { email, ticketDetails } = req.body;

  try {
    const UserCollection = getUserCollection(email);
    const newTicket = new UserCollection({ data: ticketDetails });
    await newTicket.save();

    res.json({ message: "Ticket details saved successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Error saving ticket details", error: err });
  }
};

// Routes
app.get("/busServices", getBusServices);
app.post("/busServices", addBusService);
app.post("/users/login", login);
app.post("/users/saveTicket", saveTicket);

// Cron Job
// cron.schedule("* * * * *", async () => {
//   const currentTime = new Date();
//   try {
//     const result = await BusService.deleteMany({ departureTime: { $lt: currentTime } });
//     console.log(`Deleted ${result.deletedCount} outdated bus services`);
//   } catch (err) {
//     console.error("Error deleting outdated bus services:", err);
//   }
// });

// Start the server
app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
