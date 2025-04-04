require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = "my$3cr3tK3yWithSp3ci@lCharacters";

app.use(cors({
  origin: ["http://localhost:8081", "http://localhost:8080", "https://payanam-opal.vercel.app"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const connectDB = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://smajeesh3:Ajeesh%402312@cluster0.qupuk.mongodb.net/busServiceDB?retryWrites=true&w=majority&appName=Cluster0",
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
    console.log("MongoDB connected!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

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
  leftSeats: [
    {
      label: String,
      selected: Boolean,
      booked: Boolean
    }
  ],
  rightSeats: [
    {
      label: String,
      selected: Boolean,
      booked: Boolean
    }
  ]
});
const BusService = mongoose.model("BusService", busServiceSchema);

const emailSchema = new mongoose.Schema({ email: { type: String, required: true } });
const Email = mongoose.model("Email", emailSchema);

const userModels = {}; // Cache models
const getUserCollection = (email) => {
  const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
  if (!userModels[sanitizedEmail]) {
    const userSchema = new mongoose.Schema({ data: mongoose.Schema.Types.Mixed }, { strict: false });
    userModels[sanitizedEmail] = mongoose.model(sanitizedEmail, userSchema, sanitizedEmail);
  }
  return userModels[sanitizedEmail];
};

// Routes
app.get("/busServices", async (req, res) => {
  try {
    const { from, to } = req.query; // Get parameters from request

    const query = {};
    if (from) query.serviceStartPlace = from;
    if (to) query.serviceEndPlace = to;

    const busServices = await BusService.find(query);

    res.json(busServices);
  } catch (err) {
    res.status(500).json({ message: "Error retrieving data", error: err });
  }
});

app.post("/login", async (req, res) => {
  const { email } = req.body;
  console.log("Login request received:", req.body);

  try {
    let existingEmail = await Email.findOne({ email });
    const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: "1h" });

    res.cookie("authToken", token, { httpOnly: false, secure: false });

    // Get user-specific ticket collection
    const UserTicketCollection = getUserCollection(email);

    if (existingEmail) {
      // Fetch booked tickets if user already exists
      const bookedTickets = await UserTicketCollection.find({});
      return res.json({
        message: "Login successful.",
        token,
        bookedTickets,
      });
    } else {
      // Add new email to Email collection
      await new Email({ email }).save();

      // Create an empty collection for the new user
      await UserTicketCollection.createCollection();

      return res.json({
        message: "Email added successfully! User collection created.",
        token,
        bookedTickets: [],
      });
    }
  } catch (err) {
    res.status(500).json({ message: "Error processing login", error: err });
  }
});


app.post("/bookTicket", async (req, res) => {
  const { email, ticketDetails } = req.body;

  if (!email || !ticketDetails) {
    return res.status(400).json({ message: "Email and ticket details are required" });
  }

  try {
    // Get the user's ticket collection
    const UserTicketCollection = getUserCollection(email);

    // Save the booked ticket
    const newTicket = new UserTicketCollection(ticketDetails);
    await newTicket.save();

    res.status(201).json({ message: "Ticket booked successfully!", ticket: newTicket });
  } catch (err) {
    res.status(500).json({ message: "Error booking ticket", error: err });
  }
});


app.post("/busServices", async (req, res) => {
  try {
    const {
      companyName,
      busType,
      selectedBus,
      serviceStartPlace,
      serviceEndPlace,
      departureTime,
      arrivalTime,
      seaterPrice,
      sleeperPrice,
      totalSeat,
      lowerDeckSeats,
      upperDeckSeats,
    } = req.body;

    if (
      !companyName ||
      !busType ||
      !selectedBus ||
      !serviceStartPlace ||
      !serviceEndPlace ||
      !departureTime ||
      !arrivalTime ||
      !seaterPrice ||
      !sleeperPrice ||
      !totalSeat ||
      !lowerDeckSeats ||
      !upperDeckSeats
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newBusService = new BusService({
      companyName,
      busType,
      selectedBus,
      serviceStartPlace,
      serviceEndPlace,
      departureTime,
      arrivalTime,
      seaterPrice,
      sleeperPrice,
      totalSeat,
      lowerDeckSeats,
      upperDeckSeats,
    });

    await newBusService.save();
    res.status(201).json({ message: "Bus service added successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Error adding bus service", error: err });
  }
});

app.post("/login", async (req, res) => {

  const { email } = req.body;
  console.log("Login request received:", req.body);

  try {
    let existingEmail = await Email.findOne({ email });
    const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: "1h" });

    res.cookie("authToken", token, { httpOnly: false, secure: false });

    res.json({
      message: existingEmail ? "Login successful." : "Email added successfully!",
      token,
    });

    if (!existingEmail) await new Email({ email }).save();
  } catch (err) {
    res.status(500).json({ message: "Error processing login", error: err });
  }
});

app.post("/book-seats", async (req, res) => {
  const { busId, seats } = req.body; // seats = ["L1", "L2", "R3"]

  if (!busId || !seats || !Array.isArray(seats)) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  try {
    // Fetch the existing bus seat data from MongoDB without `.lean()`
    const bus = await BusService.findById(busId);

    if (!bus) {
      return res.status(404).json({ error: "Bus not found" });
    }

    console.log("Bus Left Seats:", bus.leftSeats);
    console.log("Bus Right Seats:", bus.rightSeats);

    // Ensure seat data exists
    if (!bus.leftSeats || !bus.rightSeats) {
      return res.status(404).json({ error: "Seat data missing" });
    }

    // Update seat statuses
    bus.leftSeats = bus.leftSeats.map(seat =>
      seats.includes(seat.label) ? { ...seat, booked: true } : seat
    );
    bus.rightSeats = bus.rightSeats.map(seat =>
      seats.includes(seat.label) ? { ...seat, booked: true } : seat
    );

    // Save the updated bus document
    await bus.save();

    return res.json({
      message: "Seats booked successfully",
      updatedSeats: { leftSeats: bus.leftSeats, rightSeats: bus.rightSeats }
    });
  } catch (error) {
    console.error("Error booking seats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => console.log(`API running at http://localhost:${port}`));



// {
//   "message": "Ticket booked successfully!",
//   "ticket": {
//     "_id": "661d8e02b6239f001f8a2c3d",
//     "busId": "BUS123",
//     "seatNumber": ["A1", "A2"],
//     "journeyDate": "2025-04-05",
//     "departureTime": "10:00 AM",
//     "arrivalTime": "5:00 PM",
//     "price": 1200
//   }
// }

