const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateRegistry (ERC-721)", function () {
  async function setup() {
    const [admin, recipient, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Factory.deploy();
    return { registry, admin, recipient, other };
  }

  async function mint(registry, recipient, studentId = "STU-1", uri = "ipfs://certificate/1") {
    return registry.mintCertificate(recipient, "Amina Benali", studentId, "Licence Informatique", "2026-06-15", "Bien", uri);
  }

  it("mints an ERC-721 token and stores certificate data and URI", async function () {
    const { registry, recipient } = await setup();
    await expect(mint(registry, recipient.address))
      .to.emit(registry, "CertificateMinted").withArgs(1, "STU-1", recipient.address);
    expect(await registry.ownerOf(1)).to.equal(recipient.address);
    expect(await registry.tokenURI(1)).to.equal("ipfs://certificate/1");
    const result = await registry.getCertificate(1);
    expect(result.studentName).to.equal("Amina Benali");
    expect(result.revoked).to.equal(false);
  });

  it("restricts minting to MINTER_ROLE", async function () {
    const { registry, recipient, other } = await setup();
    await expect(mint(registry.connect(other), recipient.address))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });

  it("allows the admin to assign a minter", async function () {
    const { registry, recipient, other } = await setup();
    await registry.grantRole(await registry.MINTER_ROLE(), other.address);
    await expect(mint(registry.connect(other), recipient.address)).to.emit(registry, "CertificateMinted");
  });

  it("mints several certificates as one batch", async function () {
    const { registry, recipient, other } = await setup();
    await registry.batchMintCertificates(
      [recipient.address, other.address], ["Amina", "Youssef"], ["STU-1", "STU-2"],
      ["Licence", "Master"], ["2026-06-15", "2026-06-16"], ["Bien", "Très bien"],
      ["ipfs://1", "ipfs://2"]
    );
    expect(await registry.ownerOf(1)).to.equal(recipient.address);
    expect(await registry.ownerOf(2)).to.equal(other.address);
  });

  it("blocks duplicate student IDs, including in one batch", async function () {
    const { registry, recipient } = await setup();
    await mint(registry, recipient.address);
    await expect(mint(registry, recipient.address)).to.be.revertedWith("Student ID already used");
    await expect(registry.batchMintCertificates(
      [recipient.address, recipient.address], ["A", "B"], ["STU-2", "STU-2"],
      ["Licence", "Licence"], ["2026", "2026"], ["", ""], ["uri:1", "uri:2"]
    )).to.be.revertedWith("Student ID already used");
    expect(await registry.nextTokenId()).to.equal(2);
  });

  it("lets only an admin revoke and preserves the token", async function () {
    const { registry, recipient, other } = await setup();
    await mint(registry, recipient.address);
    await expect(registry.connect(other).revokeCertificate(1))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    await expect(registry.revokeCertificate(1)).to.emit(registry, "CertificateRevoked").withArgs(1);
    expect((await registry.getCertificate(1)).revoked).to.equal(true);
    expect(await registry.ownerOf(1)).to.equal(recipient.address);
  });

  it("rejects invalid recipients and empty URIs", async function () {
    const { registry, recipient } = await setup();
    await expect(mint(registry, ethers.ZeroAddress)).to.be.revertedWith("Recipient is required");
    await expect(mint(registry, recipient.address, "STU-1", "")).to.be.revertedWith("Token URI is required");
  });
});
