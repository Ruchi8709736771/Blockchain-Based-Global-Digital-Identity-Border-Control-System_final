const { Web3 } = require("web3");

// Initialize Web3
const web3 = new Web3("https://sepolia.infura.io/v3/0203efe818d94bc287dc9b7335b7594e");

// Contract details
const contractAddress = "0x820aaaf2d96260aba5537aec8c21f592f4d16462"; // Your deployed contract address
const userAddress = "0xC3a02856c9Cc629a1527158dE0C7328494861901"; // Your wallet address

// Encode function call with parameters
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
  ["John Doe", "P1234567", "American"] // Replace with actual values
);

// Estimate gas
web3.eth.estimateGas({
  from: userAddress,
  to: contractAddress,
  data: functionCallData
})
  .then(gas => console.log("Estimated Gas:", gas))
  .catch(error => console.error("Error:", error));
