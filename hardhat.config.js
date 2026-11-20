require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
const deployerAccount = deployerKey && (deployerKey.startsWith("0x") ? deployerKey : `0x${deployerKey}`);

// Hardhat already installs solc as a dependency; use it locally without a compiler download.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async ({ solcVersion }, _hre, runSuper) => {
  if (solcVersion === "0.8.26") {
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: solcVersion,
      longVersion: require("solc").version(),
    };
  }
  return runSuper();
});

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    ...(process.env.SEPOLIA_RPC_URL && process.env.DEPLOYER_PRIVATE_KEY
      ? {
          sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [deployerAccount],
          },
        }
      : {}),
  },
};
