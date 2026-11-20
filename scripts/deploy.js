const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const Registry = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = await Registry.deploy();
  const deploymentTx = registry.deploymentTransaction();
  await registry.waitForDeployment();

  const artifact = await hre.artifacts.readArtifact("CertificateRegistry");
  const network = await hre.ethers.provider.getNetwork();
  const config = {
    address: await registry.getAddress(),
    abi: artifact.abi,
    chainId: Number(network.chainId),
  };

  const configPath = path.join(__dirname, "..", "frontend", "src", "contract.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`CertificateRegistry deployed at: ${config.address}`);
  console.log(`Deployment transaction: ${deploymentTx.hash}`);
  console.log(`Chain ID: ${config.chainId}. Frontend config saved.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
