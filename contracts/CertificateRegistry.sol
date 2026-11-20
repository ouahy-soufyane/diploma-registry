// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice One ERC-721 token represents one academic certificate.
contract CertificateRegistry is ERC721URIStorage, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Certificate {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        bool revoked;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => Certificate) private certificates;
    mapping(bytes32 studentIdHash => bool) public studentIdUsed;

    event CertificateMinted(uint256 indexed tokenId, string studentId, address indexed recipient);
    event CertificateRevoked(uint256 indexed tokenId);

    constructor() ERC721("Academic Certificate", "ACERT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256 tokenId) {
        return _mintCertificate(to, studentName, studentId, diplomaTitle, issueDate, grade, uri);
    }

    function batchMintCertificates(
        address[] calldata to,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades,
        string[] calldata uris
    ) external onlyRole(MINTER_ROLE) nonReentrant {
        uint256 count = to.length;
        require(count > 0, "Empty batch");
        require(
            studentNames.length == count && studentIds.length == count &&
            diplomaTitles.length == count && issueDates.length == count &&
            grades.length == count && uris.length == count,
            "List lengths differ"
        );

        for (uint256 i; i < count; ++i) {
            _mintCertificate(to[i], studentNames[i], studentIds[i], diplomaTitles[i], issueDates[i], grades[i], uris[i]);
        }
    }

    function _mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade,
        string calldata uri
    ) private returns (uint256 tokenId) {
        require(to != address(0), "Recipient is required");
        require(bytes(studentName).length > 0, "Student name is required");
        require(bytes(studentId).length > 0, "Student ID is required");
        require(bytes(diplomaTitle).length > 0, "Diploma title is required");
        require(bytes(uri).length > 0, "Token URI is required");

        bytes32 idHash = keccak256(bytes(studentId));
        require(!studentIdUsed[idHash], "Student ID already used");
        studentIdUsed[idHash] = true;

        tokenId = nextTokenId++;
        certificates[tokenId] = Certificate(studentName, studentId, diplomaTitle, issueDate, grade, false);
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit CertificateMinted(tokenId, studentId, to);
    }

    function revokeCertificate(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Certificate not found");
        require(!certificates[tokenId].revoked, "Certificate already revoked");
        certificates[tokenId].revoked = true;
        emit CertificateRevoked(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function getCertificate(uint256 tokenId)
        external view returns (
            string memory studentName,
            string memory studentId,
            string memory diplomaTitle,
            string memory issueDate,
            string memory grade,
            address recipient,
            bool revoked,
            string memory uri
        )
    {
        require(_ownerOf(tokenId) != address(0), "Certificate not found");
        Certificate storage certificate = certificates[tokenId];
        return (
            certificate.studentName, certificate.studentId, certificate.diplomaTitle,
            certificate.issueDate, certificate.grade, ownerOf(tokenId),
            certificate.revoked, tokenURI(tokenId)
        );
    }
}
