const { Web3 } = require("web3");

// Initialize Web3
const web3 = new Web3("https://sepolia.infura.io/v3/0203efe818d94bc287dc9b7335b7594e");

// Contract & Wallet Details
const contractAddress = "0x820aaaf2d96260aba5537aec8c21f592f4d16462"; // Your deployed contract
const userAddress = "0xC3a02856c9Cc629a1527158dE0C7328494861901"; // Your wallet
const privateKey = "0x986082d1b9a4f77fb79e8ba19fe7eef26d5473b2ffc78d5c7ccb7aebdfb9be73"; // ⚠️ Keep it secret!

// Encode function call
const functionCallData = web3.eth.abi.encodeFunctionCall(
  {
    name: "registerIdentity",
    type: "function",
    inputs: [
      { type: "string", name: "_name" },
      { type: "string", name: "_passportNumber" },
      { type: "string", name: "_nationality" }
    ]
  },
  ["John Doe", "P1234567", "American"]
);

async function sendTransaction() {
  try {
    // Fetch gas price from network
    const gasPrice = await web3.eth.getGasPrice();
    const gasLimit = 200000; // Manually setting gas limit

    // Build the transaction
    const tx = {
      from: userAddress,
      to: contractAddress,
      gas: gasLimit,
      gasPrice: gasPrice, // Adding gas price
      data: functionCallData
    };

    // Sign the transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

    // Send the signed transaction
    web3.eth.sendSignedTransaction(signedTx.rawTransaction)
      .on("transactionHash", hash => console.log("Transaction Hash:", hash))
      .on("receipt", receipt => console.log("Transaction Successful:", receipt))
      .on("error", error => console.error("Transaction Failed:", error));

  } catch (error) {
    console.error("Error sending transaction:", error);
  }
}

// Run the transaction
sendTransaction();
