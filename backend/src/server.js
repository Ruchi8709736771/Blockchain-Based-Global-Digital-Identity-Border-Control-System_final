require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Web3 } = require("web3");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ABI = require("./abi.json");

const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables
const PORT = process.env.PORT || 5000;
const INFURA_URL = process.env.INFURA_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

if (!INFURA_URL || !CONTRACT_ADDRESS || !PRIVATE_KEY || !MONGO_URI) {
    console.error("❌ Missing environment variables. Check .env file.");
    process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
    firstName: String,
    middleName: String,
    lastName: String,
    dob: String,
    age: Number,
    gender: String,
    address: String,
    country: String,
    approvalStatus: { type: String, default: "Under Consideration" },
    passportNumber: { type: String, required: true, unique: true }, // Added passportNumber
    uniqueId: { type: String } // Added uniqueId
});

const User = mongoose.model("User", userSchema);

app.post("/signup", async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();

        // Automatically register the user on the blockchain
        const { firstName, lastName, country, passportNumber } = req.body; // Added passportNumber
        const name = `${firstName} ${lastName}`;
        const nationality = country;

        const tx = contract.methods.registerIdentity(name, passportNumber, nationality);
        const { gasPrice, gasLimit } = await getGasFees();

        const txObject = {
            to: CONTRACT_ADDRESS,
            gas: gasLimit,
            gasPrice,
            data: tx.encodeABI(),
            from: fromAddress
        };

        const signedTx = await web3.eth.accounts.signTransaction(txObject, PRIVATE_KEY);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        res.json({
            success: true,
            message: "User registered successfully",
            blockchain: {
                txHash: receipt.transactionHash,
                block: receipt.blockNumber.toString()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Define Admin Schema
const adminSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});

const Admin = mongoose.model("Admin", adminSchema);

// **🔹 Web3 Setup**
const web3 = new Web3(new Web3.providers.HttpProvider(INFURA_URL));
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
const account = web3.eth.accounts.wallet.add(PRIVATE_KEY);
const fromAddress = account[0]?.address;

console.log("✅ Wallet Address:", fromAddress);

// **🔹 Middleware for Admin Authentication**
const authenticateAdmin = async (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", ""); // Extract the token
    console.log("Received Token:", token); // Debug log

    if (!token) {
        console.error("No token provided");
        return res.status(401).json({ success: false, error: "Access denied" });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        console.log("Token verified:", verified); // Debug log
        req.admin = verified;
        next();
    } catch (error) {
        console.error("Token verification failed:", error); // Debug log
        res.status(400).json({ success: false, error: "Invalid token" });
    }
};

// **🔹 Admin Registration**
app.post("/admin/register", async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            return res.status(400).json({ success: false, error: "Admin already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({ email, password: hashedPassword });
        await newAdmin.save();

        res.json({ success: true, message: "Admin registered successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// **🔹 Admin Login**
app.post("/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });

        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(400).json({ success: false, error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ success: true, token });
    } catch (error) {
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// **🔹 Admin Approve User**
app.post("/admin/approveUser", authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.body;

        // Find the user in MongoDB
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update approval status and generate a unique ID
        user.approvalStatus = "Approved";
        user.uniqueId = `UID${Date.now()}`; // Generate a unique ID
        await user.save();

        res.json({ success: true, message: "User approved successfully", uniqueId: user.uniqueId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// **🔹 Admin Get Pending Users**
app.get("/admin/getPendingUsers", authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find({ approvalStatus: "Under Consideration" });
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// **🔹 Admin Reject User**
app.post("/admin/rejectUser", authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.body;

        // Find and delete the user
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, message: "User rejected successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// **🔹 Get Optimized Gas Fees**
async function getGasFees() {
    try {
        const gasPrice = await web3.eth.getGasPrice();
        return { gasPrice: web3.utils.toHex(gasPrice), gasLimit: 100000 };
    } catch (error) {
        return { gasPrice: web3.utils.toHex(web3.utils.toWei("1", "gwei")), gasLimit: 100000 };
    }
}

// **🔹 Register Identity API**
app.post("/registerIdentity", async (req, res) => {
    try {
        const { name, passportNumber, nationality } = req.body;
        const tx = contract.methods.registerIdentity(name, passportNumber, nationality);
        const { gasPrice, gasLimit } = await getGasFees();

        const txObject = {
            to: CONTRACT_ADDRESS, gas: gasLimit, gasPrice, data: tx.encodeABI(), from: fromAddress
        };

        const signedTx = await web3.eth.accounts.signTransaction(txObject, PRIVATE_KEY);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        res.json({ success: true, txHash: receipt.transactionHash, block: receipt.blockNumber.toString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.toString() });
    }
});

// **🔹 Verify Identity API (Only Authorized Agents)**
app.post("/verifyIdentity", async (req, res) => {
    try {
        const { userAddress } = req.body;
        const tx = contract.methods.verifyIdentity(userAddress);
        const { gasPrice, gasLimit } = await getGasFees();

        const txObject = {
            to: CONTRACT_ADDRESS, gas: gasLimit, gasPrice, data: tx.encodeABI(), from: fromAddress
        };

        const signedTx = await web3.eth.accounts.signTransaction(txObject, PRIVATE_KEY);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        res.json({ success: true, txHash: receipt.transactionHash, block: receipt.blockNumber.toString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.toString() });
    }
});

// **🔹 Get User ID (Only for Authorized Agents)**
app.get("/getUserId/:userAddress", authenticateAdmin, async (req, res) => {
    try {
        const { userAddress } = req.params;
        const userId = await contract.methods.getUserId(userAddress).call({ from: fromAddress });
        res.json({ success: true, userId });
    } catch (error) {
        res.status(403).json({ success: false, error: "Unauthorized or Identity Not Found" });
    }
});

// **🔹 Check if User is Verified (Only for Authorized Agents)**
app.get("/isUserVerified/:userAddress", authenticateAdmin, async (req, res) => {
    try {
        const { userAddress } = req.params;
        const isVerified = await contract.methods.isUserVerified(userAddress).call({ from: fromAddress });
        res.json({ success: true, isVerified });
    } catch (error) {
        res.status(403).json({ success: false, error: "Unauthorized or Identity Not Found" });
    }
});

// **🚀 Start Server**
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
