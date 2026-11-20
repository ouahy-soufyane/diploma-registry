# Diploma Registry — Devoir 2

Une petite application pédagogique pour émettre et vérifier des diplômes comme NFT ERC-721. Le contrat est volontairement court : OpenZeppelin fournit le standard NFT, les rôles et la protection contre la réentrance.

## Ce qu’il faut installer

- Node.js LTS (npm est inclus)
- MetaMask dans le navigateur

Pour la démonstration sur Hardhat local, **aucun token API ni clé privée n’est nécessaire**. Le frontend fabrique des métadonnées JSON en `data:` URI pour garder le parcours local simple. Les données d’un contrat public sont visibles par tous : n’y mettez aucune information personnelle réelle.

## Lancer en local (Windows PowerShell)

Ouvrez trois terminaux dans ce dossier.

1. Installez les dépendances :

   ```powershell
   npm.cmd install
   npm.cmd --prefix frontend install
   ```

2. Terminal 1 — lancez la blockchain locale :

   ```powershell
   npm.cmd run chain
   ```

   Gardez ce terminal ouvert.

3. Terminal 2 — déployez le contrat :

   ```powershell
   npm.cmd run deploy:local
   ```

   Le script écrit l’adresse et l’ABI dans `frontend/src/contract.json`.

4. Terminal 3 — démarrez le site :

   ```powershell
   npm.cmd run frontend
   ```

5. Dans MetaMask, ajoutez Hardhat Local : RPC `http://127.0.0.1:8545`, chain ID `31337`, symbole `ETH`. Importez un compte de démonstration affiché par Hardhat. Le compte qui déploie reçoit les rôles `DEFAULT_ADMIN_ROLE` et `MINTER_ROLE`.

## Utiliser l’application

- **Émettre un diplôme** : complétez le formulaire et connectez un compte qui a `MINTER_ROLE`. Le contrat produit un `tokenId` unique et enregistre un token URI.
- **Import en lot** : chargez un CSV avec les colonnes `studentName`, `studentId`, `diplomaTitle`, `issueDate`, `recipientAddress` et `grade`. L’application signale les lignes invalides avant d’envoyer un mint groupé.
- **Vérification publique** : recherchez par `tokenId` pour voir les données, le `tokenURI` et l’état de révocation.
- **Révoquer** : dans la fiche trouvée, le bouton de révocation envoie une transaction d’administration. Le NFT reste dans le wallet et son état devient explicitement « Révoqué ».

Les métadonnées sont créées dans le navigateur sous forme d’un JSON encodé dans une URI `data:`. Cela évite un service IPFS ou une clé API pour cette version de cours. Pour un usage réel, utiliser un stockage décentralisé, contrôler la confidentialité des attributs et vérifier le rendu par les wallets.

## Comprendre le backend

Tout le comportement métier est dans `contracts/CertificateRegistry.sol` :

1. Le constructeur crée le nom et le symbole ERC-721, puis attribue les rôles au déployeur.
2. `mintCertificate` vérifie les champs et appelle `_mintCertificate`.
3. `_mintCertificate` empêche les doublons d’identifiant, attribue le prochain tokenId, enregistre les champs, frappe le NFT et fixe le `tokenURI`.
4. `batchMintCertificates` vérifie la taille des listes puis réutilise exactement la même fonction privée pour chaque diplôme. En cas d’erreur, toute la transaction de lot est annulée.
5. `revokeCertificate` marque le certificat comme révoqué et émet un événement. Il ne brûle pas le NFT : l’historique reste vérifiable.
6. `getCertificate` renvoie les informations lisibles par l’interface. ERC-721 fournit aussi `ownerOf`, `tokenURI` et les fonctions de transfert standard.

`MINTER_ROLE` contrôle l’émission. `DEFAULT_ADMIN_ROLE` contrôle la révocation et l’administration des rôles. Les identifiants étudiants sont illustratifs : la blockchain est publique et immuable.

## Vérifier et auditer

```powershell
npm.cmd test
```

Les tests couvrent l’émission, tokenURI, rôles, lot, doublons, révocation et quelques entrées invalides. Lire [AUDIT.md](AUDIT.md) pour le périmètre, les limites et les améliorations recommandées.

## Arborescence

```text
contracts/CertificateRegistry.sol  Contrat ERC-721
test/CertificateRegistry.js        Tests Hardhat
scripts/deploy.js                  Déploiement et configuration du frontend
frontend/src/                      Application React et styles
AUDIT.md                           Mini-rapport d’audit
```

## Sepolia (facultatif)

Le projet est prêt pour un déploiement Sepolia. Pour le faire, il faut une URL RPC (qui peut contenir une clé API), un wallet de test avec de l’ETH Sepolia, et sa clé privée de déploiement. **Aucun de ces éléments n’est requis pour Hardhat local.**

Copiez `.env.example` vers `.env`, puis remplacez les deux valeurs. Gardez `.env` privé ; il est ignoré par Git. Ne mettez jamais une clé privée dans le frontend ni dans le dépôt. Déployez ensuite :

```powershell
npm.cmd run deploy:sepolia
```

Deploiement effectue le 20 novembre 2026 : chain ID `11155111`, bloc `12171839`, receipt confirme avec statut `1`.
Adresse du contrat : [`0xbd97C778087d46a8b00df11D53Ac18e1558eC710`](https://sepolia.etherscan.io/address/0xbd97C778087d46a8b00df11D53Ac18e1558eC710).
Transaction de deploiement : [`0xc887848432d5bc0dabc63d4dcb46337f157806372358d188fa1582bdd6c248a2`](https://sepolia.etherscan.io/tx/0xc887848432d5bc0dabc63d4dcb46337f157806372358d188fa1582bdd6c248a2).
