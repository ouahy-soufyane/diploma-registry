# Mini-rapport d’audit — Diploma Registry

**Nature de la revue :** revue pédagogique du code source et des tests. Ce document ne constitue pas un audit professionnel ni une garantie de sécurité de production.

## Périmètre

Contrat `CertificateRegistry.sol` : constructeur, attribution de rôles, `mintCertificate`, `batchMintCertificates`, `_mintCertificate`, `revokeCertificate`, `getCertificate` et fonctions ERC-721 héritées. Tests examinés : `test/CertificateRegistry.js`. Frontend : création locale des métadonnées et appels d’émission, lecture et révocation.

## Checklist et résultats

| Sujet | Résultat | Commentaire |
|---|---|---|
| Solidity moderne | OK | Compilateur configuré en 0.8.26. |
| Standard ERC-721 | OK | Hérite d’OpenZeppelin ERC721URIStorage. |
| Contrôle d’accès à l’émission | OK | `MINTER_ROLE` via AccessControl. |
| Contrôle d’accès à la révocation | OK | `DEFAULT_ADMIN_ROLE`. |
| Double émission | OK | Hash de `studentId` enregistré avant le mint ; un lot dupliqué est entièrement revert. |
| Adresses et champs requis | OK | Adresse zéro, nom, identifiant, titre et URI vides sont rejetés. |
| Réentrance | OK | `nonReentrant` sur les deux chemins d’émission, y compris le callback `_safeMint`. |
| Révocation et événements | OK | Flag conservé et événement avec tokenId indexé ; le NFT n’est pas détruit. |
| Overflow | OK | Solidity 0.8 vérifie les dépassements arithmétiques. |
| URI / métadonnées | Risque faible | Le frontend utilise des `data:` URI. Pas de service IPFS, de pinning ni d’image dans cette version. |
| Dependances de production | OK au scan npm | `npm audit --omit=dev` et le scan production du frontend retournent zero vulnerabilite connue. |
| Dependances de developpement | A suivre | `npm audit` signale 47 avis dans les dependances de developpement ; le correctif force bascule vers Hardhat 3 et casserait la configuration Hardhat 2. |
| Vie privée | Risque élevé en usage réel | Nom, identifiant, diplôme et URI sont publics et persistants. Utiliser seulement des données fictives. |
| Deploiement / configuration reseau | OK | Contrat deploye et verifie sur Sepolia (chain ID 11155111, transaction confirmee). |

## Risques recherchés

- **Contrôle d’accès :** mint réservé aux minters ; révocation réservée à l’admin. Le premier administrateur est le déployeur ; il peut accorder ou retirer les rôles.
- **Réentrance :** `safeMint` appelle le wallet destinataire. Les fonctions d’émission sont protégées par `ReentrancyGuard`.
- **Doublon métier :** les identifiants étudiants ne peuvent être réutilisés, même après révocation. Cela évite qu’un lot crée deux tokens pour la même personne.
- **Overflow :** compteur `uint256` sous Solidity 0.8 avec contrôles natifs.
- **Révocation :** la révocation n’annule pas les transferts ERC-721. Les interfaces doivent afficher le flag du contrat et ne pas considérer la simple possession comme preuve de validité.
- **Métadonnées :** une URI `data:` est pratique pour une démo, mais peut être volumineuse et ne remplace pas un stockage IPFS résilient.

## Tests automatisés

Le fichier de test couvre le mint ERC-721 et son événement, la lecture des champs et du tokenURI, le refus d’un compte sans rôle, l’attribution du rôle minter, le mint en lot, les doublons isolés et dans un même lot, le refus de révocation non autorisée, la révocation sans burn et les entrées invalides. Exécuter `npm test` après installation des dépendances. Aucun fuzzing, invariant, test de charge ou analyse Slither n’a été réalisé.

## Recommandations

1. Éviter les identifiants personnels en clair ; préférer des preuves cryptographiques ou un identifiant non réversible avec un protocole de vérification adapté.
2. Pour un vrai lancement, faire relire le contrat par un auditeur indépendant et ajouter fuzzing/invariants ainsi qu’une analyse Slither.
3. Définir une gouvernance d’administration (multisig, procédures de récupération et rotation des clés).
4. Déplacer images et métadonnées hors chaîne, assurer leur pinning, et documenter le format accepté.
5. Ajouter un événement de changement d’état ou une fonction de vérification retournant directement `revoked` pour les intégrateurs externes.

**Conclusion :** le périmètre de cours applique les contrôles demandés, mais la gestion des données personnelles et le stockage de démonstration rendent le système impropre à un déploiement réel sans modifications supplémentaires.

