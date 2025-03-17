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
  origin: ["http://localhost:8081","http://localhost:8080", "https://payanam-opal.vercel.app"], // Add your frontend URL
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
  lowerDeckSeats: { type: Object, required: true },
  upperDeckSeats: { type: Object, required: true },
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
    const busServices = await BusService.find();
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

    res.json({
      message: existingEmail ? "Login successful." : "Email added successfully!",
      token,
    });

    if (!existingEmail) await new Email({ email }).save();
  } catch (err) {
    res.status(500).json({ message: "Error processing login", error: err });
  }
});

app.listen(port, () => console.log(`API running at http://localhost:${port}`));
